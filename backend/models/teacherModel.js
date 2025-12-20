import pool from '../db.js';
import { withTransaction } from '../utils/helpers.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (teacherId, term, client = pool) => {
  const query = `SELECT s.id, s.student_code,s.name as full_name, ah.total_score, ahSV.total_score as old_score
      FROM ref.classes c
      JOIN ref.students s ON s.class_id = c.id
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 and ahSV.role ='student'
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 and ah.role ='teacher'
      WHERE c.teacher_id = $1 
      ORDER BY c.name, s.student_code`;

  const { rows } = await client.query(query, [teacherId, term]);
  return rows;
};

export const getStudentsNot = async (teacherId, term, client = pool) => {
  const query = `
    SELECT s.id, s.student_code, s.name as full_name, c.class_code
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 and ahSV.role ='student'
    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 and ah.role ='teacher'
    WHERE c.teacher_id = $1 AND ah.total_score IS NULL
    ORDER BY c.name, s.student_code`;
  const { rows } = await client.query(query, [teacherId, term]);
  return rows;
};

export const postStudentAllNotAssessment = async (teacherId, term, user_id) => {
  return withTransaction(async (client) => {
    const allStudentNot = await getStudentsNot(teacherId, term, client);

    for (const student of allStudentNot) {
      await client.query(`INSERT INTO drl.assessment_history (term_code, student_id, total_score, changed_by, role, note, updated_at)
        VALUES ($1, $2, 0, $3,'teacher', 'SV chưa đánh giá', now()) `,
        [term, student.id, user_id]);
    }
    return { count: allStudentNot.length };
  });
};

export const postAccept = async (teacherId, term, user_id) => {
  return withTransaction(async (client) => {
    const studentAss = await getStudents(teacherId, term, client);

    for (const student of studentAss) {
      // 1. Xác định điểm chốt
      const totalScore = student.total_score !== null
        ? student.total_score      // GV đã chấm
        : student.old_score;       // lấy điểm SV

      if (totalScore !== null) {
        await client.query(`INSERT INTO drl.assessment_history(term_code, student_id, total_score, changed_by, role, note, updated_at)
        VALUES ($1, $2, $3, $4, 'teacher', 'GV duyệt kết quả', now())
        ON CONFLICT (student_id, term_code, role)
        DO UPDATE SET
          total_score = EXCLUDED.total_score,
          changed_by  = EXCLUDED.changed_by,
          note        = EXCLUDED.note,
          updated_at  = now()
      `, [term, student.id, totalScore, user_id]);
      }
    }
  });
};

//KHoa danh gia 
export const postLockAss = async (teacherId, term, user_id) => {
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
