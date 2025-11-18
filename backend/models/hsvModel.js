import pool from '../db.js';

//Lấy danh sách lớp 
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

//Lấy danh sách tiêu chí sinh viên có tham gia CLB,HSV,...
export const getStudents = async (class_code, term) =>{
    const query = `SELECT s.student_code, s.full_name,ctn.code AS criterion_code,self_score,
      sa.text_value, sa.is_hsv_verified, sa.hsv_note
    FROM ref.student s JOIN ref.class c ON s.class_id = c.id
        LEFT JOIN drl.criterion ctn ON ctn.term_code = $2 AND ctn.require_hsv_verify = TRUE
        LEFT JOIN drl.self_assessment sa ON sa.student_id = s.id AND sa.term_code = $2 AND sa.criterion_id = ctn.id
    WHERE c.code = $1
    ORDER BY c.code, s.student_code;`;

    const { rows } = await pool.query(query, [class_code, term]);
    return rows;
};

//Lấy danh sách của tất cả sinh viên cần xác nhận

//Tính lại tổng điểm khi hsv xác nhận
export const putTotal_Score = async (student_id,term_code) =>{
    const checkTotal = await pool.query(`select coalesce(sum(self_score), 0) as total_score from drl.self_assessment where student_id=$1 and term_code=$2`,[student_id,term_code]);

    const totalScore = checkTotal.rows[0].total_score;
    
    //Cạp nhật điểm vào lại bảng điểm
    await pool.query(
    `insert into drl.term_score (student_id, term_code, total_score, updated_at, rank)
     values ($1, $2, $3, now(), drl.rank_by_score($3))
     on conflict(student_id, term_code)
     do update set total_score = $3, updated_at = now(), rank = excluded.rank`,
    [student_id, term_code, totalScore]);

    return totalScore;
}; 

//Xác nhận sinh viên
export const postConfirm = async (student_code,term_code,criterion_code,participated,note,username) =>{
    //Lấy id của sinh viên
    const sqlStudent = await pool.query( `select id from ref.student where student_code = $1`, [student_code]);

    if(!sqlStudent.rowCount) throw new Error('Không có sinh viên này');
    const studentID = sqlStudent.rows[0].id;

    //Lấy id tiêu chí cần hsv xác nhận
    const sqlCriteria = await pool.query(
        `select id, max_points from drl.criterion where term_code = $1 and code = $2 and require_hsv_verify = true limit 1`,[term_code, criterion_code]);
       
    if (!sqlCriteria.rowCount) throw new Error('Không có tiêu chí này');
    
    const criterionID = sqlCriteria.rows[0].id;
    const maxp = sqlCriteria.rows[0].max_points || 0;
    const score = participated ? maxp : 0;

    //Lấy nọi dung CLB mà sinh viên gửi lên HSV
    const cur = await pool.query(
        `select text_value from drl.self_assessment where student_id=$1 and term_code=$2 and criterion_id=$3`,[studentID, term_code,criterionID]);
    
    const currentText = cur.rowCount ? cur.rows[0].text_value : null;

    await pool.query(
    `INSERT INTO drl.self_assessment(student_id, term_code, criterion_id, text_value, self_score,
      is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7,now(),now())
    ON CONFLICT (student_id, term_code, criterion_id)
    DO UPDATE SET
        text_value      = COALESCE($4, drl.self_assessment.text_value),
        self_score      = EXCLUDED.self_score,
        is_hsv_verified = TRUE,
        hsv_note        = EXCLUDED.hsv_note,
        hsv_verified_by = EXCLUDED.hsv_verified_by,
        hsv_verified_at = now(),
        updated_at      = now()`,
    [studentID, term_code, criterionID, currentText, score, note || null, username]);

    const totalScore = await putTotal_Score(studentID, term_code);
    return {message:"Xacs nahn",studentID, term_code, criterionID, currentText, score, note, username,totalScore};

};