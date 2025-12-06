import pool from '../db.js';

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
      o.score,
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
    left join drl.criterion_option o on sa.option_id = o.id 
    WHERE c.code = $1
    ORDER BY c.code, s.student_code, criterion_code`;

    const { rows } = await pool.query(query, [class_code, term]);
    return rows;
};

const recalculateTotalScore = async (student_id, term_code, client) => {
    const checkTotal = await client.query(
        `SELECT COALESCE(SUM(self_score), 0) as total_score 
         FROM drl.self_assessment 
         WHERE student_id=$1 AND term_code=$2`,
        [student_id, term_code]
    );

    const totalScore = checkTotal.rows[0].total_score;
    
    await client.query(
        `INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
         VALUES ($1, $2, $3, now(), drl.rank_by_score($3))
         ON CONFLICT(student_id, term_code)
         DO UPDATE SET total_score = $3, updated_at = now(), rank = EXCLUDED.rank`,
        [student_id, term_code, totalScore]
    );

    return totalScore;
};

export const postConfirm = async (student_code, term_code, criterion_code, participated, note, username) => {
    const client = await pool.connect();
    
    try {
        await client.query("BEGIN");
        
        const { rows: [student] } = await client.query(
            `SELECT id FROM ref.student WHERE student_code = $1 FOR UPDATE`,
            [student_code]
        );
        if (!student) throw new Error('Không có sinh viên này');

        const { rows: [criterion] } = await client.query(
            `SELECT id, type, max_points FROM drl.criterion 
             WHERE term_code = $1 AND code = $2 AND require_hsv_verify = TRUE`,
            [term_code, criterion_code]
        );
        if (!criterion) throw new Error('Không có tiêu chí này');

        const { rows: [assessment] } = await client.query(
            `SELECT option_id, text_value FROM drl.self_assessment 
             WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
            [student.id, term_code, criterion.id]
        );

        let score = 0;
        
        if (!participated) {
            score = 0;
        }
        else {
            if (criterion.type === 'radio') {
                if (assessment?.option_id) {
                    const { rows: [option] } = await client.query(
                        `SELECT score FROM drl.criterion_option WHERE id = $1`,
                        [assessment.option_id]
                    );
                    score = option?.score || 0;
                }
            } else {
                const hasContent = assessment?.text_value && assessment.text_value.trim() !== '';
                score = hasContent ? criterion.max_points : 0;
            }
        }

        await client.query(
            `INSERT INTO drl.self_assessment(
               student_id, term_code, criterion_id, option_id, text_value, self_score,
               is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7, $8, now(), now())
             ON CONFLICT (student_id, term_code, criterion_id)
             DO UPDATE SET
               self_score = EXCLUDED.self_score,
               is_hsv_verified = TRUE,
               hsv_note = EXCLUDED.hsv_note,
               hsv_verified_by = EXCLUDED.hsv_verified_by,
               hsv_verified_at = now(),
               updated_at = now()`,
            [student.id, term_code, criterion.id, assessment?.option_id, assessment?.text_value, score, note || null, username]
        );

        // Tính lại tổng điểm
        const totalScore = await recalculateTotalScore(student.id, term_code, client);
        
        await client.query("COMMIT");
        
        return {
            message: "Xác nhận thành công",
            score,
            totalScore
        };
        
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
};

// Bỏ xác nhận HSV
export const postUnconfirm = async (student_code, term_code, criterion_code) => {
    const client = await pool.connect();
    
    try {
        await client.query("BEGIN");
        
        const { rows: [student] } = await client.query(
            `SELECT id FROM ref.student WHERE student_code = $1`,
            [student_code]
        );
        if (!student) throw new Error('Không có sinh viên này');

        const { rows: [criterion] } = await client.query(
            `SELECT id FROM drl.criterion WHERE term_code = $1 AND code = $2`,
            [term_code, criterion_code]
        );
        if (!criterion) throw new Error('Không có tiêu chí này');

        // Reset về trạng thái chưa xác nhận
        await client.query(
            `UPDATE drl.self_assessment
             SET self_score = 0, is_hsv_verified = FALSE, hsv_note = NULL,
                 hsv_verified_by = NULL, hsv_verified_at = NULL, updated_at = now()
             WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
            [student.id, term_code, criterion.id]
        );

        const totalScore = await recalculateTotalScore(student.id, term_code, client);
        
        await client.query("COMMIT");
        
        return { message: "Đã bỏ xác nhận", totalScore };
        
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