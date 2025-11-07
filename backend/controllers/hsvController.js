import {checkRole,getClass} from '../models/hsvModel.js'
import pool from '../db.js';

// Helper kiểm tra quyền HSV/Đoàn Khoa
const checkHSVAccess = async (req, res) => {
  const {username} = req.query || {};
    if(!username) return res.status(400).json({error:"Không có tên đăng nhập"});

    try {
      

      res.json({
        message:"Truy cập thành công!",
        role: ckrole.faculty_code ? "Đoàn khoa" : "HSV",
        faculty_code: ckrole.faculty_code,
      });
    } catch (error) {
      console.error('Lỗi ở checkHSCAccess', error);
      res.status(500).send({message:"Lỗi hệ thống"});
    } 
};

export const getClasses = async (req, res) => {
  const { username, term } = req.query || {};
  if (!username || !term) return res.status(400).json({ error: 'missing_params' });

  try {
    const ckrole = await checkRole(username);
      if (!ckrole.allowed) {
        return res.status(403).json({ error: 'Không có quyền truy cập'});
      }
    const rows = await getClass(term,ckrole.faculty_code);
    res.json(rows);

  } catch (error) {
    console.error('Lỗi ở getClasses', error);
    res.status(500).send({message:"Lỗi hệ thống"});
  }
};

export const getClassStudents = async (req, res, next) => {
  const { class_code, term, username } = req.query; // Thêm username để check quyền (tùy chọn)
  if (!class_code || !term) return res.status(400).json({ error: 'missing_params' });

   // OPTIONAL: Kiểm tra xem user HSV có quyền xem lớp này không (nếu là Đoàn Khoa)
   // if (username) { ... logic kiểm tra quyền ... }


  try {
    // Lấy ID và max_points của tiêu chí 2.1
    const c21Res = await pool.query("SELECT id, max_points FROM drl.criterion WHERE term_code = $1 AND code = '2.1' LIMIT 1", [term]);
    const criterion21Id = c21Res.rowCount ? c21Res.rows[0].id : null;
    // Không tìm thấy tiêu chí 2.1 không phải là lỗi nghiêm trọng, vẫn trả về ds SV
     if (!criterion21Id) {
         console.warn(`Criterion '2.1' not found for term ${term}`);
     }


    const { rows } = await pool.query(
      `
      SELECT
        s.student_code, s.full_name,
        -- Lấy điểm 2.1 từ self_assessment nếu criterion21Id tồn tại
        COALESCE(sa.self_score, 0)::int AS score_21,
        COALESCE(sa.is_hsv_verified, false) AS verified,
        sa.hsv_note,
        sa.text_value AS request_note
      FROM ref.class c
      JOIN ref.student s ON s.class_id = c.id
      LEFT JOIN drl.self_assessment sa ON sa.student_id = s.id
         AND sa.term_code = $2
         AND sa.criterion_id = $3 -- Join với criterion_id tìm được
      WHERE c.code = $1
      ORDER BY s.student_code
    `,
      [class_code.trim(), term, criterion21Id] // Truyền criterion21Id vào query
    );
    res.json(rows);
  } catch (err) {
    console.error('HSV Get Class Students Error:', err);
    next(err);
  }
};

export const postConfirmAssessment = async (req, res, next) => {
  const { student_code, term_code, participated, note, username } = req.body || {};
  if (!student_code || !term_code || typeof participated !== 'boolean' || !username) {
    return res.status(400).json({ error: 'missing_body_or_username' });
  }

  // OPTIONAL: Kiểm tra quyền của username này (có phải HSV/Union không?)

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sidRes = await client.query(`SELECT id FROM ref.student WHERE student_code = $1`, [student_code.trim()]);
    if (!sidRes.rowCount) throw new Error('student_not_found');
    const student_id = sidRes.rows[0].id;

    const c21Res = await client.query(`SELECT id, max_points FROM drl.criterion WHERE term_code=$1 AND code='2.1' LIMIT 1`, [term_code]);
    if (!c21Res.rowCount) throw new Error('criterion_2_1_not_found');
    const criterion_id = c21Res.rows[0].id;
    const maxp = c21Res.rows[0].max_points || 0;
    const score = participated ? maxp : 0;

    // Lấy text_value hiện tại (ghi chú của SV) để không bị ghi đè mất
    const currentSa = await client.query(
        `SELECT text_value FROM drl.self_assessment
         WHERE student_id = $1 AND term_code = $2 AND criterion_id = $3`,
        [student_id, term_code, criterion_id]
    );
    const currentTextValue = currentSa.rowCount ? currentSa.rows[0].text_value : null;


    await client.query(
      `
      INSERT INTO drl.self_assessment
        (student_id, term_code, criterion_id, option_id, text_value, self_score,
         is_hsv_verified, hsv_note, hsv_verified_by, hsv_verified_at, updated_at)
      VALUES ($1, $2, $3, NULL, $4, $5, TRUE, $6, $7, now(), now())
      ON CONFLICT (student_id, term_code, criterion_id)
      DO UPDATE SET
        option_id       = NULL,
        text_value      = COALESCE($4, drl.self_assessment.text_value), -- Giữ lại text_value nếu $4 là NULL
        self_score      = EXCLUDED.self_score,
        is_hsv_verified = TRUE,
        hsv_note        = EXCLUDED.hsv_note,
        hsv_verified_by = EXCLUDED.hsv_verified_by,
        hsv_verified_at = now(),
        updated_at      = now()
    `,
      [
        student_id,
        term_code,
        criterion_id,
        currentTextValue, // Truyền text_value hiện tại vào
        score,
        note || null,
        username.trim(),
      ]
    );

    // SAU KHI XÁC NHẬN, CẦN TÍNH LẠI ĐIỂM TỔNG KỲ VÀ CÁC ĐIỂM KHÁC
    // await client.query('SELECT drl.recompute_term_score($1, $2)', [student_id, term_code]);
    // await client.query('SELECT drl.recompute_academic_year_score($1, (SELECT year FROM ref.term WHERE code = $2))', [student_id, term_code]);
    // await client.query('SELECT drl.recompute_program_score($1)', [student_id]);
    // --> Nên gọi các function này thông qua trigger hoặc xử lý bất đồng bộ để tránh làm chậm response

    await client.query('COMMIT');
    res.json({ ok: true, score });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('HSV Confirm Assessment Error:', err);
     if (err.message === 'student_not_found' || err.message === 'criterion_2_1_not_found') {
         res.status(404).json({ error: err.message });
     } else {
        next(err);
     }
  } finally {
    client.release();
  }
};