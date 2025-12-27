import pool from "../db.js";
import { withTransaction } from '../utils/helpers.js';

export const getStudentClass = async (username, term) => {
    const query = `SELECT s.student_code,s.name,ah.total_score AS total_score,ahSV.total_score AS old_score, ah.note 
	    FROM ref.students leader
	    JOIN ref.students s ON s.class_id = leader.class_id
	    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 AND ahSV.role = 'student'
	    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 AND ah.role = 'leader'
	    WHERE leader.student_code = $1 AND leader.is_class_leader = true
	    ORDER BY s.student_code`;
    const {rows} = await pool.query(query,[username, term]);
    console.log(rows);
    return rows;
};

export const postLeaderAssessment = async (student_code, term_code, items , user_id, note) =>{
  const studentID = await pool.query("select id from ref.students where student_code = $1",[student_code]);

  if (studentID.rowCount === 0) {
    throw new Error("Student_404");
  }

  const student_id = studentID.rows[0].id;

  for (const it of items) {
    //lưu các đánh giá vào self_assessment và các bảng liên quan
    await pool.query(
      `INSERT INTO drl.self_assessment (student_id, term_code, criterion_id, option_id, text_value, self_score, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (student_id, criterion_id, term_code)
      DO UPDATE SET 
        option_id = EXCLUDED.option_id,
        text_value = EXCLUDED.text_value,
        self_score = EXCLUDED.self_score,
        updated_at = now()`,      
        [student_id, term_code, it.criterion_id, it.option_id || null, it.text_value || null, it.score || 0]);
  }

  //Tính tổng điểm
  const sumPoint = items.reduce((sum, x) => sum + (x.score || 0), 0);
  
  await pool.query(
    `INSERT INTO drl.assessment_history ( term_code,student_id, total_score, changed_by, role, note, updated_at)
      VALUES ($1, $2, $3, $4, 'leader', $5, now())
      ON CONFLICT (student_id, term_code, role)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        changed_by = EXCLUDED.changed_by,
        note = EXCLUDED.note,
        updated_at = now()`,
      [term_code,student_id, sumPoint,user_id,note]
  );

};

export const postLeaderAccept = async (studentId, term, user_id) => {
  return withTransaction(async (client) => {
    const Lock = await checkLeaderLocked(studentId, term, client);
    if (Lock) {
      const error = new Error("Đánh giá đã bị khóa, không thể duyệt lại");
      error.status = 403;
      throw error;
    }

    // Lấy class_id của leader
    const leaderClass = await client.query(`SELECT class_id FROM ref.students WHERE id = $1 AND is_class_leader = true`, [studentId]);
    if (leaderClass.rowCount === 0) {
      throw new Error("Không phải lớp trưởng");
    }
    const class_id = leaderClass.rows[0].class_id;

    // Lấy tất cả sinh viên trong lớp
    const students = await client.query(`
      SELECT s.id, s.student_code, ah.total_score, ahSV.total_score AS old_score
      FROM ref.students s
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 AND ah.role = 'leader'
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 AND ahSV.role = 'student'
      WHERE s.class_id = $1
      ORDER BY s.student_code
    `, [class_id, term]);

    for (const student of students.rows) {
      const totalScore = student.total_score !== null
        ? student.total_score      // Leader đã chấm
        : student.old_score;       // lấy điểm SV

      if (totalScore !== null) {
        await client.query(`INSERT INTO drl.assessment_history(term_code, student_id, total_score, changed_by, role, updated_at)
        VALUES ($1, $2, $3, $4, 'leader', now())
        ON CONFLICT (student_id, term_code, role)
        DO UPDATE SET
          total_score = EXCLUDED.total_score,
          changed_by  = EXCLUDED.changed_by,
          updated_at  = now()
      `, [term, student.id, totalScore, user_id]);
      }
    }
  });
};

//KHoa danh gia 
export const postLockAss = async (studentId, term) => {
  return withTransaction(async (client) => {
    // Lấy class_id của leader
    const cls = await client.query(`SELECT class_id FROM ref.students WHERE id = $1 AND is_class_leader = true`, [studentId]);
    if (cls.rowCount === 0) return;
    const class_id = cls.rows[0].class_id;

    await client.query(`INSERT INTO drl.class_term_status(class_id, term_code, is_leader_approved, leader_approved_at, updated_at)
        VALUES ($1, $2, true, now(), now())
        ON CONFLICT (class_id, term_code)
        DO UPDATE SET
          is_leader_approved = true,
          leader_approved_at = now(),
          updated_at = now()
    `, [class_id, term]);
  });
};

//kiem tra khoa 
export const checkLeaderLocked = async (studentId, term, client = pool) => {
  const rs = await client.query(`
    SELECT cts.is_leader_approved FROM ref.classes c
    JOIN drl.class_term_status cts ON c.id = cts.class_id
    WHERE c.id = (SELECT class_id FROM ref.students WHERE id = $1 AND is_class_leader = true) AND cts.term_code = $2`, [studentId, term]);

  return rs.rowCount > 0 && rs.rows[0].is_leader_approved === true;
};


