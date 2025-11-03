import pool from '../db.js';

/** Lấy faculty_code của user có quyền 'faculty' và đang active */
export const getFacultyCodeByUsername = async (username) => {
  const u = await pool.query(
    `SELECT faculty_code FROM auth.user_account
     WHERE username = $1 AND role_code = 'faculty' AND is_active = TRUE`,
    [username]
  );
  if (!u.rowCount || !u.rows[0].faculty_code) return null;
  return u.rows[0].faculty_code;
};

/*
u là cái dưới: 
{
  command: 'SELECT',
  rowCount: 1,
  oid: null,
  rows: [
    { faculty_code: 'CNTT' }   // ← đây chính là u.rows[0]
  ],
  fields: [...],
  _parsers: [...],
  RowCtor: null,
  rowAsArray: false
}
  trả về row[0] 
*/

/** Danh sách lớp thuộc khoa trong 1 term, kèm tổng SV, số SV đã nộp và điểm TB */
export const listClassesByFacultyAndTerm = async (faculty_code, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      c.code AS class_code, c.name AS class_name,
      COUNT(s.id) AS total_students,
      COUNT(DISTINCT ts.student_id) AS completed,
      COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score
    FROM ref.class c
    JOIN ref.faculty f ON f.id = c.faculty_id
    LEFT JOIN ref.student s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE f.code = $1
    GROUP BY c.id, c.code, c.name
    ORDER BY c.code
    `,
    [faculty_code, term]
  );
  return rows;
};

/** Kiểm tra lớp có thuộc khoa không */
export const isClassInFaculty = async (class_code, faculty_code) => {
  const r = await pool.query(
    `SELECT 1
     FROM ref.class c
     JOIN ref.faculty f ON c.faculty_id = f.id
     WHERE c.code = $1 AND f.code = $2`,
    [class_code, faculty_code]
  );
  return !!r.rowCount;
};

/** Lấy danh sách SV của lớp trong một term */
export const listStudentsInClassForTerm = async (class_code, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      s.student_code, s.full_name,
      c.code AS class_code,
      COALESCE(ts.total_score, 0)::int AS total_score
    FROM ref.class c
    JOIN ref.student s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE c.code = $1
    GROUP BY s.student_code, s.full_name, c.code, ts.total_score
    ORDER BY s.student_code
    `,
    [class_code, term]
  );
  return rows;
};
