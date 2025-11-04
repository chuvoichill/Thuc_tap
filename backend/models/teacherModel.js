import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async () =>{
    const query = `select s.student_code, s.full_name, c.code AS class_code, c.name AS class_name,
        -- Tính tổng điểm từ bảng term_score nếu có, fallback về self_assessment
        COALESCE(ts.total_score, SUM(sa.self_score) FILTER (WHERE sa.id IS NOT NULL), 0)::int AS total_score
      FROM ref.class_advisor ca
      JOIN ref.class   c ON c.id = ca.class_id
      JOIN ref.student s ON s.class_id = c.id
      LEFT JOIN drl.self_assessment sa ON sa.student_id = s.id AND sa.term_code = $2
      LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
      WHERE ca.advisor_username = $1`

    const {rows}= await pool.query(query,[]);
    return rows
}; 