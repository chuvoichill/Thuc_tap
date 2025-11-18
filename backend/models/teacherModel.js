import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (username, term, class_code ) =>{
  const params = [username.trim(), term];  
  let query = `select s.student_code, s.full_name, c.code as class_code, c.name as class_name,coalesce(ts.total_score, 0)::int as total_score
    from ref.class_advisor ca
    join ref.class c on c.id = ca.class_id
    join ref.student s on s.class_id = c.id
    left join drl.self_assessment sa on sa.student_id = s.id and sa.term_code = $2
    left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
    where ca.advisor_username = $1`;
  if (class_code) {
    query += ' and c.code = $3';
    params.push(class_code.trim());
  }

  query += `group by s.student_code, s.full_name, c.code, c.name, ts.total_score
            order by c.code, s.student_code `;

  const {rows}= await pool.query(query,params);
  return rows;
}; 