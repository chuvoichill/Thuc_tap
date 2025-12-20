import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (username, term) => {
  const query = `SELECT s.student_code,s.name as full_name, ah.total_score, ahSV.total_score as old_score, ah.note
      FROM ref.teachers t
      JOIN ref.classes c ON c.teacher_id = t.id
      JOIN ref.students s ON s.class_id = c.id
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 and ahSV.role ='student'
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 and ah.role ='teacher'
      WHERE t.teacher_code = $1 
      ORDER BY c.name, s.student_code`;

  const { rows } = await pool.query(query, [username, term]);
  return rows;
};

export const getStudentsNot = async (username, term) => {
  const query = `
    SELECT s.student_code, s.name as full_name, c.class_code
    FROM ref.teachers t
    JOIN ref.classes c ON c.teacher_id = t.id
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 and ahSV.role ='student'
    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 and ah.role ='teacher'
    WHERE t.teacher_code = $1 AND ah.total_score IS NULL
    ORDER BY c.name, s.student_code`;
  const { rows } = await pool.query(query, [username, term]);
  return rows;
};

export const postStudentAllNotAssessment = async (username, term, user_id) => {
  const allStudentNot = await getStudentsNot(username, term);

  for (const student of allStudentNot) {
    const studentid = await pool.query(`SELECT id FROM ref.students WHERE student_code = $1`, [student.student_code]);

    if (studentid.rowCount > 0) {
      const student_id = studentid.rows[0].id;

      await pool.query(`INSERT INTO drl.assessment_history (term_code, student_id, total_score, changed_by, role, note, updated_at)
        VALUES ($1, $2, 0, $3,'teacher', 'SV chưa đánh giá', now()) `,
        [term, student_id, user_id]);
    }
  }
};

export const postAccept = async (username, term, user_id) => {
  const studentAss = await getStudents(username, term);

  for (const student of studentAss) {
    const studentid = await pool.query(`SELECT id FROM ref.students WHERE student_code = $1`, [student.student_code]);

    if (studentid.rowCount > 0) {
      const student_id = studentid.rows[0].id;

      // 1. Xác định điểm chốt
      const totalScore = student.total_score !== null
        ? student.total_score      // GV đã chấm
        : student.old_score;       // lấy điểm SV

      if (totalScore !== null) {
        await pool.query(`INSERT INTO drl.assessment_history(term_code, student_id, total_score, changed_by, role, updated_at)
        VALUES ($1, $2, $3, $4, 'teacher', now())
        ON CONFLICT (student_id, term_code, role)
        DO UPDATE SET
          total_score = EXCLUDED.total_score,
          changed_by  = EXCLUDED.changed_by,
          updated_at  = now()
      `, [term, student_id, totalScore, user_id]);
      }
    }
  }
};

//KHoa danh gia 
export const postLockAss = async (teacher_code, term, user_id) => {
  // Lấy class_id của GV
  const cls = await pool.query(`SELECT c.id FROM ref.teachers t JOIN ref.classes c ON c.teacher_id = t.id WHERE t.teacher_code = $1`, [teacher_code]);

  if (cls.rowCount === 0) return;
  const class_id = cls.rows[0].id;
  await pool.query(`INSERT INTO drl.class_term_status(class_id, term_code, is_teacher_approved, teacher_approved_at, updated_at)
      VALUES ($1, $2, true, now(), now())
      ON CONFLICT (class_id, term_code)
      DO UPDATE SET
        is_teacher_approved = true,
        teacher_approved_at = now(),
        updated_at = now()
  `, [class_id, term]);

  return;
};

// Lấy tất cả sinh viên trong lớp (không cần điều kiện đã đánh giá)
export const getAllStudentsInClass = async (username, term) => {
  const query = `
    SELECT 
      s.student_code, 
      s.name as full_name, 
      s.is_class_leader,
      c.class_code,
      COALESCE(ts.total_score, 0) as total_score
    FROM ref.teachers t
    JOIN ref.classes c ON c.teacher_id = t.id
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE t.teacher_code = $1 
    ORDER BY s.name
  `;
  const { rows } = await pool.query(query, [username, term]);
  return rows;
};
