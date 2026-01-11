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

export const reportTeacher = async (term_code, teacher_id) => {
  console.log(`🔍 [REPORT TEACHER MODEL] Querying for term_code: ${term_code}, teacher_id: ${teacher_id}`);
  
  const query = `
    WITH group_scores AS (
      SELECT 
        sa.student_id,
        cg.id as group_id,
        cg.code as group_code,
        ROW_NUMBER() OVER (PARTITION BY sa.student_id ORDER BY cg.code) as group_order,
        SUM(sa.self_score) as group_score
      FROM drl.self_assessment sa
      JOIN drl.criterion cr ON cr.id = sa.criterion_id
      JOIN drl.criteria_group cg ON cg.id = cr.group_id
      WHERE sa.term_code = $1
      GROUP BY sa.student_id, cg.id, cg.code
    )
    SELECT 
      s.student_code, 
      s.name as full_name, 
      c.name as class_code,
      c.name as class_name,
      f.name as faculty_name,
      SUBSTRING(s.student_code FROM 1 FOR 2) as course,
      COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) as total_score,
      CASE 
        WHEN COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) >= 90 THEN 'Xuất sắc'
        WHEN COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) >= 80 THEN 'Tốt'
        WHEN COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) >= 65 THEN 'Khá'
        WHEN COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) >= 50 THEN 'Trung bình'
        WHEN COALESCE(ah_teacher.total_score, ah_leader.total_score, 0) >= 35 THEN 'Yếu'
        ELSE 'Kém'
      END as rank,
      t.semester, 
      t.year,
      COALESCE((SELECT group_score FROM group_scores WHERE student_id = s.id AND group_order = 1), 0) as tc1,
      COALESCE((SELECT group_score FROM group_scores WHERE student_id = s.id AND group_order = 2), 0) as tc2,
      COALESCE((SELECT group_score FROM group_scores WHERE student_id = s.id AND group_order = 3), 0) as tc3,
      COALESCE((SELECT group_score FROM group_scores WHERE student_id = s.id AND group_order = 4), 0) as tc4,
      COALESCE((SELECT group_score FROM group_scores WHERE student_id = s.id AND group_order = 5), 0) as tc5
    FROM ref.classes c
    JOIN ref.students s ON s.class_id = c.id
    JOIN ref.faculties f ON c.faculty_id = f.id
    LEFT JOIN ref.term t ON t.code = $1
    LEFT JOIN drl.assessment_history ah_leader 
      ON ah_leader.student_id = s.id 
      AND ah_leader.term_code = $1 
      AND ah_leader.role = 'leader'
    LEFT JOIN drl.assessment_history ah_teacher 
      ON ah_teacher.student_id = s.id 
      AND ah_teacher.term_code = $1 
      AND ah_teacher.role = 'teacher'
    WHERE c.teacher_id = $2
      AND (ah_leader.total_score IS NOT NULL OR ah_teacher.total_score IS NOT NULL)
    ORDER BY c.class_code, s.student_code
  `;
  
  try {
    const { rows } = await pool.query(query, [term_code, teacher_id]);
    console.log(`✅ [REPORT TEACHER MODEL] Query returned ${rows.length} rows`);
    return rows;
  } catch (error) {
    console.error(`❌ [REPORT TEACHER MODEL] Database error:`, error);
    throw error;
  }
};
