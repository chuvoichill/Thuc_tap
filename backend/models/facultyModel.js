import pool from '../db.js';

/** Danh sách lớp thuộc khoa trong 1 term, kèm tổng SV, số SV đã nộp và điểm TB */
export const listClassesByFacultyAndTerm = async (faculty_code, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      c.name AS class_name,
      COUNT(s.id) AS total_students,
      COUNT(DISTINCT ts.student_id) AS completed,
      COALESCE(ROUND(AVG(ts.total_score) FILTER (WHERE ts.total_score IS NOT NULL)), 0)::numeric(5,2) AS avg_score
    FROM ref.classes c
    JOIN ref.faculties f ON f.id = c.faculty_id
    LEFT JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE f.faculty_code = $1
    GROUP BY c.id, c.name
    ORDER BY c.name
    `,
    [faculty_code, term]
  );
  return rows;
};

/** Kiểm tra lớp có thuộc khoa không */
export const isClassInFaculty = async (class_code, faculty_code) => {
  const r = await pool.query(
    `SELECT 1
     FROM ref.classes c
     JOIN ref.faculties f ON c.faculty_id = f.id
     WHERE c.name = $1 AND f.faculty_code = $2`,
    [class_code, faculty_code]
  );
  return !!r.rowCount;
};

/** Lấy danh sách SV của lớp trong một term */
export const listStudentsInClassForTerm = async (class_code, term) => {
  const { rows } = await pool.query(
    `
    SELECT
      s.student_code, s.name as full_name,
      c.name AS class_name,
      COALESCE(ts.total_score, 0)::int AS total_score
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE c.name = $1
    GROUP BY s.student_code, s.name, c.name, ts.total_score
    ORDER BY s.student_code
    `,
    [class_code, term]
  );
  return rows;
};
