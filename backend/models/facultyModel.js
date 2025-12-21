import pool from '../db.js';
import { withTransaction } from '../utils/helpers.js';

// Danh sách lớp thuộc khoa trong 1 term, kèm tổng SV, số SV đã nộp và điểm TB 
export const listClassesByFacultyAndTerm = async (faculty_id, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      c.name AS class_name,
      COUNT(s.id) AS total_students,
      COUNT(DISTINCT ts.student_id) AS completed,
      COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score,
     
      -- Lấy thêm trạng thái duyệt để hiển thị ở Frontend
      COALESCE(st.is_teacher_approved, false) AS is_teacher_approved,
      COALESCE(st.is_faculty_approved, false) AS is_faculty_approved
    
      FROM ref.classes c
    LEFT JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    LEFT JOIN drl.class_term_status st ON st.class_id = c.id AND st.term_code = $2
    WHERE c.faculty_id = $1
    GROUP BY c.id, c.name, st.is_teacher_approved, st.is_faculty_approved
    ORDER BY c.name
    `,
    [faculty_id, term]
  );
  return rows;
};

// Kiểm tra lớp có thuộc khoa không
export const isClassInFaculty = async (class_code, faculty_id) => {
  const r = await pool.query(
    `SELECT 1
     FROM ref.classes c
     WHERE c.name = $1 AND c.faculty_id = $2`, 
    [class_code, faculty_id]
  );
  return !!r.rowCount;
};

// Lấy danh sách SV của lớp trong một term 
export const listStudentsInClassForTerm = async (class_code, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      s.student_code, 
      s.name as full_name,
      c.name AS class_name,
      -- Lấy điểm Giáo viên chấm (từ lịch sử)
      COALESCE(ah_teacher.total_score, 0)::int AS teacher_score,
      -- Lấy điểm Khoa chấm (từ lịch sử - có thể null nếu khoa chưa chấm)
      ah_faculty.total_score::int AS faculty_score,
      -- Điểm tổng kết hiện tại
      COALESCE(ts.total_score, 0)::int AS total_score
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    -- Join lấy điểm Teacher
    LEFT JOIN drl.assessment_history ah_teacher 
      ON ah_teacher.student_id = s.id AND ah_teacher.term_code = $2 AND ah_teacher.role = 'teacher'
    -- Join lấy điểm Faculty
    LEFT JOIN drl.assessment_history ah_faculty 
      ON ah_faculty.student_id = s.id AND ah_faculty.term_code = $2 AND ah_faculty.role = 'faculty'
    WHERE c.name = $1
    ORDER BY s.student_code
    `,
    [class_code, term]
  );
  return rows;
};

// Kiểm tra quyền sửa điểm của Khoa (SV thuộc khoa + chưa được giáo viên duyệt + chưa bị Admin chốt)
export const checkEditAccess = async (student_code, faculty_id, term_code) => {
  const res = await pool.query(
    `SELECT 
       (c.faculty_id = $2) as in_faculty,
       COALESCE(st.is_admin_approved, false) as is_locked,
       COALESCE(st.is_teacher_approved, false) as is_teacher_approved
     FROM ref.students s
     JOIN ref.classes c ON s.class_id = c.id
     LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $3
     WHERE s.student_code = $1`,
    [student_code, faculty_id, term_code]
  );
  if (res.rowCount === 0) return { in_faculty: false, is_locked: false };
  return res.rows[0];
};

// Khoa duyệt bảng điểm của một lớp
export const approveClassByFaculty = async (class_code, faculty_id, term) => {
  return withTransaction(async (client) => {
    //Lấy thông tin lớp và trạng thái hiện tại 
    const { rows } = await client.query(
      `SELECT 
          c.id as class_id,
          COALESCE(st.is_teacher_approved, false) as is_teacher_approved,
          COALESCE(st.is_admin_approved, false) as is_admin_approved
       FROM ref.classes c
       LEFT JOIN drl.class_term_status st ON c.id = st.class_id AND st.term_code = $3
       WHERE c.name = $1 AND c.faculty_id = $2`,
      [class_code, faculty_id, term]
    );

    if (rows.length === 0) {
      throw new Error('CLASS_NOT_FOUND_OR_NOT_IN_FACULTY');
    }

    const { class_id, is_teacher_approved, is_admin_approved } = rows[0];

    if (!is_teacher_approved) throw new Error('TEACHER_NOT_APPROVED_YET');
    if (is_admin_approved) throw new Error('CLASS_LOCKED_BY_ADMIN');

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
