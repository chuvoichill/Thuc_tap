import pool from '../db.js';

//Kiem tra role
export const checkRole = async (username) => {
    const query = `select faculty_code from auth.user_account where username = $1 and (role_code = 'union' or role_code = 'hsv') and is_active = true`;

    const role = await pool.query(query,[username]);
    if (!role.rowCount) return { allowed: false };
    // Nếu có faculty_code -> Đoàn Khoa, chỉ xem được khoa đó
    // Nếu không có faculty_code -> HSV Trường, xem được hết
    return { allowed: true, faculty_code: role.rows[0].faculty_code || null };
};    

//:Lấy danh sách lớp 
export const getClass = async (term, faculty_code) => {
    let query = `SELECT f.code AS faculty_code, c.code AS class_code, c.name AS class_name, COUNT(s.id) AS total_students, COUNT(DISTINCT ts.student_id) AS completed
        FROM ref.class c
        JOIN ref.faculty f ON f.id = c.faculty_id
        LEFT JOIN ref.student s ON s.class_id = c.id
        LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $1`;
    const params = [term];

    if (faculty_code) {
        query += ' WHERE f.code = $2';
        params.push(faculty_code);
    }

    query += `
        GROUP BY f.code, c.code, c.name 
        ORDER BY f.code, c.code`;

    const { rows } = await pool.query(query, params);
    return rows;
};