import pool from "../../db.js";

export const getSearchClassStudents = async (student) => {
  let conditions = [];
  let values = [];
  let idx = 1;
  if(student.studentCode){
    conditions.push(`s.student_code ILIKE $${idx}`);
    values.push(`%${student.studentCode}%`);
    idx++;
  }
  if(student.name){
    conditions.push(`s.full_name ILIKE $${idx}`);
    values.push(`%${student.name}%`);
    idx++;
  }
  if(student.classCode){
    conditions.push(`c.code ILIKE $${idx}`);
    values.push(`%${student.classCode}%`);
    idx++;
  }
  const whereClause = conditions.length > 0 ? "AND " + conditions.join(" AND ") : "";
  const query = `
    select s.student_code, s.full_name, c.code 
from ref.student s
inner join ref.class c 
ON s.class_id = c.id
where 1=1 ${whereClause}
order by s.student_code;
  `;
  const { rows } = await pool.query(query, values);
  return rows;
};

