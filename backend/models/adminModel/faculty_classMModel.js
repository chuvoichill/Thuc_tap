import pool from "../../db.js";

export const getfaculty = async (term) =>{
    const query = `SELECT s.student_code,s.name as full_name,c.name as class_name, f.name as faculty_name, ah.total_score, ahSV.total_score as old_score, ah.note
      FROM ref.faculties f
      join ref.classes c on f.id = c.faculty_id 
      JOIN ref.students s ON s.class_id = c.id
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $1 and ahSV.role ='faculty'
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $1 and ah.role ='admin'
      ORDER BY f.name, s.student_code`;

    const {rows} = await pool.query(query,[term]);
    return rows;
};

export const getClass = async (term, faculty) =>{
    const params = [term];
    
    let query = `select f.faculty_code as faculty_code, c.name as class_name,
        count(s.id) as total_students,
        count(distinct ts.student_id) as completed,
        coalesce(round(avg(ts.total_score) filter (where ts.total_score is not null)),0)::numeric(5,2) as avg_score
        from ref.classes c
        join ref.faculties f on f.id = c.faculty_id
        left join ref.students s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $1
        where 1 = 1`;

    if (faculty) {
        query += ` and f.faculty_code = $2`;
        params.push(faculty.trim());
    }

    query += `  group by f.faculty_code, c.id, c.name
                order by f.faculty_code, c.name`;

    const {rows} = await pool.query(query,params);
    return rows;
};

export const getStudent = async (class_code,term) =>{
    const query = `select s.student_code, s.name as full_name, c.name as class_name,
        coalesce(ts.total_score, 0)::int as total_score
        from ref.classes c
        join ref.students s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
        where c.name = $1
        order by s.student_code`;

    const {rows} = await pool.query(query,[class_code,term]);
    return rows;
};