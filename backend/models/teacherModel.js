import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (username, term, class_code ) =>{
  const params = [username.trim(), term];  
  let query = `select s.student_code, s.full_name, c.code AS class_code, c.name AS class_name,COALESCE(ts.total_score, 0)::int AS total_score
    FROM ref.class_advisor ca
    JOIN ref.class   c ON c.id = ca.class_id
    JOIN ref.student s ON s.class_id = c.id
    LEFT JOIN drl.self_assessment sa ON sa.student_id = s.id AND sa.term_code = $2
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE ca.advisor_username = $1`;
  if (class_code) {
    query += ' AND c.code = $3';
    params.push(class_code.trim());
  }

  query += `
    GROUP BY s.student_code, s.full_name, c.code, c.name, ts.total_score
    ORDER BY c.code, s.student_code
  `;

  const {rows}= await pool.query(query,params);
  return rows;
}; 