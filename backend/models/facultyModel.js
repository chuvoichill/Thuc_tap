import pool from '../db.js';
import { withTransaction } from '../utils/helpers.js';

// Lấy danh sách toàn bộ SV thuộc khoa trong 1 term
export const listStudentsByFacultyAndTerm = async (faculty_id, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      s.student_code,
      s.name as full_name,
      c.name AS class_name,
      COALESCE(ah_teacher.total_score, 0)::int AS teacher_score,
      ah_faculty.total_score::int AS faculty_score,
      ah_faculty.note,
      COALESCE(st.is_faculty_approved, false) as is_faculty_approved
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $2
    LEFT JOIN drl.assessment_history ah_teacher 
      ON ah_teacher.student_id = s.id AND ah_teacher.term_code = $2 AND ah_teacher.role = 'teacher'
    LEFT JOIN drl.assessment_history ah_faculty 
      ON ah_faculty.student_id = s.id AND ah_faculty.term_code = $2 AND ah_faculty.role = 'faculty'
    WHERE c.faculty_id = $1
      AND COALESCE(st.is_teacher_approved, false) = true
    ORDER BY c.name, s.student_code
    `,
    [faculty_id, term]
  );
  return rows;
};

// Kiểm tra quyền sửa điểm của Khoa (SV thuộc khoa + chưa được giáo viên duyệt)
export const checkEditAccess = async (student_code, faculty_id, term_code) => {
  const res = await pool.query(
    `SELECT 
       (c.faculty_id = $2) as in_faculty,
       COALESCE(st.is_teacher_approved, false) as is_teacher_approved,
       COALESCE(st.is_faculty_approved, false) as is_faculty_approved
     FROM ref.students s
     JOIN ref.classes c ON s.class_id = c.id
     LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $3
     WHERE s.student_code = $1`,
    [student_code, faculty_id, term_code]
  );
  if (res.rowCount === 0) return { in_faculty: false };
  return res.rows[0];
};

// Khoa duyệt bảng điểm của một lớp
export const approveClassByFaculty = async (class_code, faculty_id, term, user_id) => {
  return withTransaction(async (client) => {
    //Lấy thông tin lớp và trạng thái hiện tại 
    const { rows } = await client.query(
      `SELECT 
          c.id as class_id,
          COALESCE(st.is_teacher_approved, false) as is_teacher_approved,
          COALESCE(st.is_faculty_approved, false) as is_faculty_approved
       FROM ref.classes c
       LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $3
       WHERE c.name = $1 AND c.faculty_id = $2`,
      [class_code, faculty_id, term]
    );

    if (rows.length === 0) {
      throw new Error('CLASS_NOT_FOUND_OR_NOT_IN_FACULTY');
    }

    const { class_id, is_teacher_approved, is_faculty_approved } = rows[0];

    if (!is_teacher_approved) throw new Error('TEACHER_NOT_APPROVED_YET');

    // Sao chép tổng điểm giáo viên sang điểm khoa nếu khoa chưa có dữ liệu đánh giá
    await client.query(
      `INSERT INTO drl.assessment_history (student_id, term_code, role, total_score, changed_by, created_at, updated_at)
       SELECT 
         ah_teacher.student_id,
         ah_teacher.term_code,
         'faculty' as role,
         ah_teacher.total_score,
         $3 as changed_by,
         now() as created_at,
         now() as updated_at
       FROM drl.assessment_history ah_teacher
       JOIN ref.students s ON s.id = ah_teacher.student_id
       WHERE s.class_id = $1
         AND ah_teacher.term_code = $2
         AND ah_teacher.role = 'teacher'
         AND NOT EXISTS (
           SELECT 1 FROM drl.assessment_history ah_faculty
           WHERE ah_faculty.student_id = ah_teacher.student_id
             AND ah_faculty.term_code = ah_teacher.term_code
             AND ah_faculty.role = 'faculty'
         )`,
      [class_id, term, user_id]
    );

    if (!is_teacher_approved) throw new Error('TEACHER_NOT_APPROVED_YET');
    if (is_faculty_approved) throw new Error('FACULTY_ALREADY_APPROVED');
    //Cập nhật trạng thái duyệt của khoa
    await client.query(
      `INSERT INTO drl.class_term_status (class_id, term_code, is_faculty_approved, faculty_approved_at, updated_at)
       VALUES ($1, $2, true, now(), now())
       ON CONFLICT (class_id, term_code)
       DO UPDATE SET is_faculty_approved = true, faculty_approved_at = now(), updated_at = now()`,
      [class_id, term]
    );
  });
};

// Kiểm tra xem khoa đã duyệt chưa
export const checkFacultyLocked = async (faculty_id, class_code, term) => {
  const res = await pool.query(
    `SELECT COALESCE(st.is_faculty_approved, false) as is_faculty_approved
     FROM ref.classes c
     LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $3
     WHERE c.name = $1 AND c.faculty_id = $2`,
    [class_code, faculty_id, term]
  );
  return res.rowCount > 0 && res.rows[0].is_faculty_approved === true;
};
