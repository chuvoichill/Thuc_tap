import pool from "../db.js";
export const reportFaculty = async (term_code, faculty_code) => {
  const query = `select s.student_code, s.full_name, c.code as class_code,f.name, ts.total_score, ts.rank, t.semester, t.year
        from ref.term t join drl.term_score ts on t.code = ts.term_code
        left join ref.student s on ts.student_id = s.id 
        left join ref.class c on s.class_id = c.id 
        left join ref.faculty f on c.faculty_id = f.id
        where ts.term_code = $1 and f.code = $2
        order by f.code, c.code, s.student_code`;
  const { rows } = await pool.query(query, [term_code, faculty_code]);
  return rows;
};
