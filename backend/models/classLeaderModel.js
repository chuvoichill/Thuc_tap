import pool from "../db.js";
import { withTransaction } from '../utils/helpers.js';

export const getStudentClass = async (username, term) => {
    const query = `SELECT s.id, s.student_code,s.name,ah.total_score AS total_score,ahSV.total_score AS old_score, ah.note 
	    FROM ref.students leader
	    JOIN ref.students s ON s.class_id = leader.class_id
	    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 AND ahSV.role = 'student'
	    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 AND ah.role = 'leader'
	    WHERE leader.student_code = $1 AND leader.is_class_leader = true
	    ORDER BY s.student_code`;
    const {rows} = await pool.query(query,[username, term]);
    return rows;
};

export const postLeaderAccept = async (studentId, term, user_id, username) => {
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

    // Lấy tất cả sinh viên trong lớp
    const students = await getStudentClass(username, term);

    for (const student of students) {
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

// Kiểm tra giáo viên có phải GVCN của lớp không
export const checkTeacherClass = async (class_code, teacher_code) => {
  const result = await pool.query(
    `SELECT c.id, c.class_code, t.teacher_code
     FROM ref.classes c
     JOIN ref.teachers t ON c.teacher_id = t.id
     WHERE c.class_code = $1 AND t.teacher_code = $2`,
    [class_code, teacher_code]
  );
  return result.rows[0] || null;
};

// Kiểm tra sinh viên có thuộc lớp không
export const checkStudentInClass = async (student_code, class_id) => {
  const result = await pool.query(
    `SELECT id FROM ref.students 
     WHERE student_code = $1 AND class_id = $2`,
    [student_code, class_id]
  );
  return result.rows[0] || null;
};

// Bỏ chỉ định lớp trưởng cũ
export const removeOldClassLeader = async (class_id) => {
  await pool.query(
    `UPDATE ref.students 
     SET is_class_leader = FALSE, updated_at = NOW()
     WHERE class_id = $1 AND is_class_leader = TRUE`,
    [class_id]
  );
};

// Chỉ định lớp trưởng mới
export const assignNewClassLeader = async (student_id) => {
  await pool.query(
    `UPDATE ref.students 
     SET is_class_leader = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [student_id]
  );
};

// Bỏ chỉ định lớp trưởng và trả về student_code
export const removeClassLeaderByClassId = async (class_id) => {
  const result = await pool.query(
    `UPDATE ref.students 
     SET is_class_leader = FALSE, updated_at = NOW()
     WHERE class_id = $1 AND is_class_leader = TRUE
     RETURNING student_code`,
    [class_id]
  );
  return result.rows[0] || null;
};

// Lấy thông tin lớp trưởng của lớp
export const getClassLeaderByClassCode = async (class_code, teacher_code) => {
  const result = await pool.query(
    `SELECT s.student_code, s.name, s.is_class_leader
     FROM ref.students s
     JOIN ref.classes c ON s.class_id = c.id
     JOIN ref.teachers t ON c.teacher_id = t.id
     WHERE c.class_code = $1 AND t.teacher_code = $2 AND s.is_class_leader = TRUE`,
    [class_code, teacher_code]
  );
  return result.rows[0] || null;
};

// Kiểm tra quyền lớp trưởng của sinh viên
export const checkClassLeaderRoleByStudentCode = async (student_code) => {
  const result = await pool.query(
    `SELECT is_class_leader, c.class_code, c.name as class_name
     FROM ref.students s
     JOIN ref.classes c ON s.class_id = c.id
     WHERE s.student_code = $1`,
    [student_code]
  );
  return result.rows[0] || null;
};
