import pool from "../db.js";
export const reportFaculty = async (term_code, faculty_code) => {
  const query = `
    SELECT 
      s.student_code, 
      s.name as full_name, 
      c.class_code, 
      f.name, 
      COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) as total_score,
      CASE 
        WHEN COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) >= 90 THEN 'Xuất sắc'
        WHEN COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) >= 80 THEN 'Tốt'
        WHEN COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) >= 65 THEN 'Khá'
        WHEN COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) >= 50 THEN 'Trung bình'
        WHEN COALESCE(ah_faculty.total_score, ah_teacher.total_score, 0) >= 35 THEN 'Yếu'
        ELSE 'Kém'
      END as rank,
      t.semester, 
      t.year
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    JOIN ref.faculties f ON c.faculty_id = f.id
    LEFT JOIN ref.term t ON t.code = $1
    LEFT JOIN drl.assessment_history ah_teacher 
      ON ah_teacher.student_id = s.id 
      AND ah_teacher.term_code = $1 
      AND ah_teacher.role = 'teacher'
    LEFT JOIN drl.assessment_history ah_faculty 
      ON ah_faculty.student_id = s.id 
      AND ah_faculty.term_code = $1 
      AND ah_faculty.role = 'faculty'
    WHERE f.faculty_code = $2
      AND (ah_teacher.total_score IS NOT NULL OR ah_faculty.total_score IS NOT NULL)
    ORDER BY f.faculty_code, c.class_code, s.student_code
  `;
  const { rows } = await pool.query(query, [term_code, faculty_code]);
  return rows;
};
