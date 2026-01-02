import pool from '../db.js';
import { withTransaction } from '../utils/helpers.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (teacherId, term, client = pool) => {
  const query = `SELECT 
      s.id, 
      s.student_code,
      s.name as full_name, 
      s.is_class_leader,
      c.class_code,
      ah.total_score, 
      ahSV.total_score as old_score, 
      ah.note
      FROM ref.classes c
      JOIN ref.students s ON s.class_id = c.id
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 and ahSV.role ='leader'
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 and ah.role ='teacher'
      WHERE c.teacher_id = $1
      ORDER BY c.name, s.student_code`;

  const { rows } = await client.query(query, [teacherId, term]);
  return rows;
};

// Kiểm tra tất cả sinh viên đã tự đánh giá
const checkAllAss = async (class_id, term, client) => {
  const query = await client.query(`
    SELECT COUNT(*) as total_students,
           COUNT(ah.id) as assessed_students
    FROM ref.students s
    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id 
      AND ah.term_code = $2 
      AND ah.role = 'leader'
    WHERE s.class_id = $1
  `, [class_id, term]);

  const { total_students, assessed_students } = query.rows[0];
  
  if (parseInt(total_students) !== parseInt(assessed_students)) {
    const error = new Error(`Chưa đủ sinh viên tự đánh giá.`);
    error.status = 403;
    throw error;
  }
};
export const postAccept = async (teacherId, term, user_id) => {
  return withTransaction(async (client) => {
    const Lock = await checkTeacherLocked(teacherId, term, client);
    if (Lock) {
      const error = new Error("Đánh giá đã bị khóa, không thể duyệt lại");
      error.status = 403;
      throw error;
    }

    // Lấy class_id của giáo viên
    const classInfo = await client.query(`SELECT id FROM ref.classes WHERE teacher_id = $1`, [teacherId]);
    if (classInfo.rowCount === 0) {
      throw new Error("Không tìm thấy lớp học");
    }
    const class_id = classInfo.rows[0].id;

    // Kiểm tra tất cả sinh viên đã tự đánh giá
    await checkAllAss(class_id, term, client);

    const leaderAss = await getStudents(teacherId, term, client);

    for (const student of leaderAss) {
      // Nếu GV đã chấm -> lấy điểm GV
      // Nếu GV chưa chấm -> lấy điểm Leader (old_score)
      // Nếu cả 2 đều chưa -> mặc định 0
      const totalScore = student.total_score !== null
        ? student.total_score      // GV đã chấm
        : (student.old_score !== null ? student.old_score : 0);  // lấy điểm Leader hoặc 0

      await client.query(`INSERT INTO drl.assessment_history(term_code, student_id, total_score, changed_by, role, updated_at)
      VALUES ($1, $2, $3, $4, 'teacher', now())
      ON CONFLICT (student_id, term_code, role)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        changed_by  = EXCLUDED.changed_by,
        updated_at  = now()`, 
      [term, student.id, totalScore, user_id]);
    }
  });
};

//KHoa danh gia 
export const postLockAss = async (teacherId, term) => {
  return withTransaction(async (client) => {
    // Lấy class_id của GV
    const cls = await client.query(`SELECT id FROM ref.classes WHERE teacher_id = $1`, [teacherId]);

    if (cls.rowCount === 0) return;
    const class_id = cls.rows[0].id;
    await client.query(`INSERT INTO drl.class_term_status(class_id, term_code, is_teacher_approved, teacher_approved_at, updated_at)
        VALUES ($1, $2, true, now(), now())
        ON CONFLICT (class_id, term_code)
        DO UPDATE SET
          is_teacher_approved = true,
          teacher_approved_at = now(),
          updated_at = now()
    `, [class_id, term]);
  });
};

//kiem tra khoa 
export const checkTeacherLocked = async (teacherId, term, client = pool) => {
  const rs = await client.query(`
    SELECT cts.is_teacher_approved FROM ref.classes c
    JOIN drl.class_term_status cts  ON c.id = cts.class_id
    WHERE c.teacher_id = $1 AND cts.term_code = $2`, [teacherId, term]);

  return rs.rowCount > 0 && rs.rows[0].is_teacher_approved === true;
};

// Lấy tất cả sinh viên trong lớp (không cần điều kiện đã đánh giá)
export const getAllStudentsInClass = async (teacherId, term) => {
  const query = `
    SELECT 
      s.student_code, 
      s.name as full_name, 
      s.is_class_leader,
      c.class_code,
      COALESCE(ts.total_score, 0) as total_score
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE c.teacher_id = $1 
    ORDER BY s.name
  `;
  const { rows } = await pool.query(query, [teacherId, term]);
  return rows;
};
