import pool from "../../db.js";

export const getfaculty = async (term) =>{
    const query = `select f.code as faculty_code, f.name as faculty_name,
        count(s.id) as total_students,
        count(distinct ts.student_id) as completed,
        coalesce(round(avg(ts.total_score) filter (where ts.total_score is not null)), 0)::numeric(5,2) as avg_score
        from ref.faculty f
        left join ref.class c on c.faculty_id = f.id
        left join ref.student s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $1
        group by f.id, f.code, f.name
        order by f.code`;

    const {rows} = await pool.query(query,[term]);
    return rows;
};

export const getClass = async (term, faculty) =>{
    const params = [term];
    
    let query = `select f.code as faculty_code,c.code as class_code,c.name as class_name,
        count(s.id) as total_students,
        count(distinct ts.student_id) as completed,
        coalesce(round(avg(ts.total_score) filter (where ts.total_score is not null)),0)::numeric(5,2) as avg_score
        from ref.class c
        join ref.faculty f on f.id = c.faculty_id
        left join ref.student s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $1
        where 1 = 1`;

    if (faculty) {
        query += ` and f.code = $2`;
        params.push(faculty.trim());
    }

    query += `  group by f.code, c.id, c.code, c.name
                order by f.code, c.code`;

    const {rows} = await pool.query(query,params);
    return rows;
};

export const getStudent = async (class_code,term) =>{
    const query = `select s.student_code, s.full_name,c.code as class_code,
        coalesce(ts.total_score, 0)::int as total_score
        from ref.class c
        join ref.student s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
        where c.code = $1
        order by s.student_code`;

    const {rows} = await pool.query(query,[class_code,term]);
    return rows;
};