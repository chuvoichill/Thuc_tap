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
    const query = `SELECT 
      s.student_code, 
      s.full_name,
      ctn.id AS criterion_id,
      ctn.code AS criterion_code,
      ctn.title AS criterion_title,
      ctn.type AS criterion_type,
      ctn.max_points,
      sa.option_id,
      sa.self_score,
      sa.text_value, 
      sa.is_hsv_verified, 
      sa.hsv_note,
      -- ✅ Lấy options nếu type = radio
      COALESCE((
        SELECT json_agg(
          json_build_object(
            'id', o.id,
            'label', o.label,
            'score', o.score
          )
          ORDER BY o.id
        )
        FROM drl.criterion_option o
        WHERE o.criterion_id = ctn.id
      ), '[]'::json) as options
    FROM ref.student s 
    JOIN ref.class c ON s.class_id = c.id
    LEFT JOIN drl.criterion ctn ON ctn.term_code = $2 AND ctn.require_hsv_verify = TRUE
    LEFT JOIN drl.self_assessment sa ON sa.student_id = s.id AND sa.term_code = $2 AND sa.criterion_id = ctn.id
    WHERE c.code = $1
    ORDER BY c.code, s.student_code;`;

    const { rows } = await pool.query(query, [class_code, term]);
    return rows;
};

//Lấy danh sách của tất cả sinh viên cần xác nhận

//Tính lại tổng điểm khi hsv xác nhận (helper function, không dùng transaction riêng)
const recalculateTotalScore = async (student_id, term_code, client) => {
    const checkTotal = await client.query(
        `SELECT COALESCE(SUM(self_score), 0) as total_score 
         FROM drl.self_assessment 
         WHERE student_id=$1 AND term_code=$2`,
        [student_id, term_code]
    );

    const totalScore = checkTotal.rows[0].total_score;
    
    //Cập nhật điểm vào lại bảng điểm
    await client.query(
        `INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
         VALUES ($1, $2, $3, now(), drl.rank_by_score($3))
         ON CONFLICT(student_id, term_code)
         DO UPDATE SET total_score = $3, updated_at = now(), rank = EXCLUDED.rank`,
        [student_id, term_code, totalScore]
    );

    return totalScore;
};

// ✅ FIXED: Xác nhận sinh viên với Transaction Lock
export const postConfirm = async (student_code, term_code, criterion_code, participated, note, username) => {
    const client = await pool.connect();
    
    try {
        await client.query("BEGIN");
        
        // ✅ FIX 1: Lock row để tránh race condition
        const sqlStudent = await client.query(
            `SELECT id FROM ref.student WHERE student_code = $1 FOR UPDATE`,
            [student_code]
        );

        if (!sqlStudent.rowCount) throw new Error('Không có sinh viên này');
        const studentID = sqlStudent.rows[0].id;

        // ✅ FIX 2: Lấy id tiêu chí cần hsv xác nhận và type
        const sqlCriteria = await client.query(
            `SELECT id, type, max_points FROM drl.criterion 
             WHERE term_code = $1 AND code = $2 AND require_hsv_verify = TRUE 
             LIMIT 1`,
            [term_code, criterion_code]
        );
           
        if (!sqlCriteria.rowCount) throw new Error('Không có tiêu chí này');
        
        const criterionID = sqlCriteria.rows[0].id;
        const criterionType = sqlCriteria.rows[0].type;
        const maxp = sqlCriteria.rows[0].max_points || 0;
        
        // ✅ FIX 3: Tính điểm dựa trên type
        let score = 0;
        let finalOptionId = null;
        let finalTextValue = null;
        
        if (criterionType === 'radio') {
            // Type = radio: Lấy điểm từ option sinh viên đã chọn (nếu participated = true)
            if (participated) {
                const savedAssessment = await client.query(
                    `SELECT option_id FROM drl.self_assessment 
                     WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
                    [studentID, term_code, criterionID]
                );
                
                if (savedAssessment.rowCount && savedAssessment.rows[0].option_id) {
                    finalOptionId = savedAssessment.rows[0].option_id;
                    
                    // Lấy điểm từ option
                    const optionScore = await client.query(
                        `SELECT score FROM drl.criterion_option WHERE id = $1`,
                        [finalOptionId]
                    );
                    
                    score = optionScore.rowCount ? (optionScore.rows[0].score || 0) : 0;
                } else {
                    // Không có option được chọn
                    score = 0;
                }
            } else {
                // participated = false → điểm = 0
                score = 0;
            }
        } else {
            // Type = text: Checkbox Có/Không
            score = participated ? maxp : 0;
            
            // Lấy text sinh viên đã nhập
            const cur = await client.query(
                `SELECT text_value FROM drl.self_assessment 
                 WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
                [studentID, term_code, criterionID]
            );
            
            finalTextValue = cur.rowCount ? cur.rows[0].text_value : null;
        }

        // ✅ FIX 4: Insert/Update với lock
        // ✅ FIX 6: is_hsv_verified = TRUE khi HSV xác nhận (dù cho 0đ hay không)
        //           Chỉ = FALSE khi HSV BỎ xác nhận (note rỗng)
        const isVerified = (note && note.trim() !== '') ? true : false;
        
        await client.query(
            `INSERT INTO drl.self_assessment(
               student_id, term_code, criterion_id, option_id, text_value, self_score,
               is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at, updated_at
             )
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now())
             ON CONFLICT (student_id, term_code, criterion_id)
             DO UPDATE SET
               option_id       = EXCLUDED.option_id,
               text_value      = EXCLUDED.text_value,
               self_score      = EXCLUDED.self_score,
               is_hsv_verified = EXCLUDED.is_hsv_verified,
               hsv_note        = EXCLUDED.hsv_note,
               hsv_verified_by = EXCLUDED.hsv_verified_by,
               hsv_verified_at = now(),
               updated_at      = now()`,
            [studentID, term_code, criterionID, finalOptionId, finalTextValue, score, isVerified, note || null, username]
        );

        // ✅ FIX 5: Tính lại tổng điểm trong transaction
        const totalScore = await recalculateTotalScore(studentID, term_code, client);
        
        await client.query("COMMIT");
        
        return {
            message: participated ? "Xác nhận thành công" : "Đã bỏ xác nhận",
            studentID,
            term_code,
            criterionID,
            criterionType,
            option_id: finalOptionId,
            text_value: finalTextValue,
            score,
            is_verified: participated,
            note,
            username,
            totalScore
        };
        
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// Legacy export để backward compatibility
export const putTotal_Score = async (student_id, term_code) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const totalScore = await recalculateTotalScore(student_id, term_code, client);
        await client.query("COMMIT");
        return totalScore;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};