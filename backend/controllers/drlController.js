import pool from '../db.js';
import { toNum} from '../utils/helpers.js';
import { getCriteria } from '../models/drlModel.js';
import { getSelfAssessment_student } from '../models/drlModel.js';

export const getCriteriaController = async (req, res) => {
  const { term } = req.query;
  if (!term) return res.status(400).json({ error: "Không tìm thấy học kì" });

  try {
    const rows = await getCriteria(term);
    res.json(rows);
  } catch (error) {
    console.error('Lỗi ở getCriteriaController nè!',error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

export const getSelfAssessment = async (req, res) => {
    const { student_code, term } = req.query || {};
    if (!student_code || !term) return res.status(400).json({ error: 'Không tìm thấy MSV hoặc học kì!' });

    try {
        // Lấy dữ liệu tự đánh giá
        const rows = await getSelfAssessment_student(student_code,term);
        if (rows == []) {
            return res.status(404).json({ error: 'Không tìm thấy MSV hoặc học kì' });
        }
        res.json(rows);
    } catch (error) {
        console.error('Lỗi ở getSelfAssessment!', error);
        res.status(500).send({message: "Lỗi hệ thống"});
    }
};

export const saveSelfAssessment = async (req, res, next) => {
  const { student_code, term_code, items } = req.body || {};
  // --- Thêm kiểm tra đầu vào cơ bản ---
  if (!student_code || !term_code || !Array.isArray(items)) {
    return res.status(400).json({ error: 'missing_body_or_items_invalid' });
  }
  // --- Hết kiểm tra ---

  const client = await pool.connect();
  try {
    // --- Kiểm tra kỳ học có mở không ---
    const termStatusRes = await client.query(
      'SELECT is_assessment_open FROM ref.term WHERE code = $1',
      [term_code]
    );

    if (termStatusRes.rowCount === 0) {
      // Không cần rollback vì chưa BEGIN
      return res.status(404).json({ error: 'term_not_found' });
    }

    if (termStatusRes.rows[0].is_assessment_open !== true) {
      // Không cần rollback
      return res.status(403).json({ error: 'assessment_period_closed' });
    }
    // --- Hết kiểm tra kỳ học ---

    await client.query('BEGIN'); // Bắt đầu Transaction

    // --- Lấy student_id ---
    const sidRes = await client.query(`SELECT id FROM ref.student WHERE student_code = $1`, [student_code.trim()]);
    if (!sidRes.rowCount) {
      await client.query('ROLLBACK'); // Hoàn tác
      return res.status(404).json({ error: 'student_not_found' });
    }
    const student_id = sidRes.rows[0].id;
    // --- Hết lấy student_id ---

    // --- Lấy ID tiêu chí 2.1 (nếu có) ---
    let criterion21Id = null;
    try {
        const c21Res = await client.query("SELECT id FROM drl.criterion WHERE term_code = $1 AND code = '2.1' LIMIT 1", [term_code]);
        if (c21Res.rowCount) criterion21Id = c21Res.rows[0].id;
    } catch (e) { console.warn("Could not find criterion 2.1:", e.message); }
    // --- Hết lấy ID tiêu chí 2.1 ---

    // --- Lặp qua các mục gửi lên và INSERT/UPDATE ---
    for (const it of items) {
      const criterion_id = toNum(it.criterion_id);
      // Bỏ qua nếu không có criterion_id hợp lệ
      if (!criterion_id) {
          console.warn('Skipping item with invalid criterion_id:', it);
          continue;
      }

      // Xác định mệnh đề WHERE cho UPDATE dựa trên tiêu chí 2.1
      const whereClause = (criterion_id === criterion21Id)
         ? 'WHERE drl.self_assessment.is_hsv_verified IS NOT TRUE' // Chỉ update 2.1 nếu HSV chưa xác nhận
         : ''; // Các tiêu chí khác luôn cho phép update

      // *** SỬA LỖI SQL Ở ĐÂY ***
      // Hoàn thiện câu lệnh INSERT ... ON CONFLICT
      await client.query(
        `
        INSERT INTO drl.self_assessment
          (student_id, term_code, criterion_id, option_id, text_value, self_score, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, now())
        ON CONFLICT (student_id, term_code, criterion_id) -- Khóa unique
        DO UPDATE SET                                     -- Nếu bị trùng (đã có bản ghi) thì cập nhật
          option_id  = EXCLUDED.option_id,                -- Cập nhật option_id bằng giá trị mới (từ VALUES)
          text_value = EXCLUDED.text_value,               -- Cập nhật text_value bằng giá trị mới
          self_score = EXCLUDED.self_score,               -- Cập nhật self_score bằng giá trị mới
          updated_at = now()                              -- Cập nhật thời gian
        ${whereClause}                                    -- Thêm điều kiện WHERE (nếu là tiêu chí 2.1)
        `,
         [ // Mảng các giá trị tương ứng với $1, $2, ...
             student_id,                                 // $1
             term_code,                                  // $2
             criterion_id,                               // $3
             it.option_id == null ? null : toNum(it.option_id), // $4 (option_id hoặc null)
             it.text_value ?? null,                      // $5 (text_value hoặc null)
             toNum(it.score) || 0,                       // $6 (điểm, mặc định là 0)
         ]
      );
      // *** HẾT SỬA LỖI SQL ***
    }
    // --- Hết vòng lặp ---

    // --- Tính lại tổng điểm ---
    const totalRes = await client.query(
        `SELECT COALESCE(SUM(self_score), 0)::int AS total
         FROM drl.self_assessment
         WHERE student_id = $1 AND term_code = $2`,
        [student_id, term_code]
    );
    const total = totalRes.rows[0].total;
    // --- Hết tính tổng điểm ---

    // --- (Quan trọng) Cập nhật điểm vào bảng term_score ---
    // Gọi hàm recompute_term_score hoặc thực hiện INSERT/UPDATE trực tiếp
     await client.query(
         `INSERT INTO drl.term_score(student_id, term_code, total_score, rank, updated_at)
          VALUES ($1, $2, $3, drl.rank_by_score($3), now())
          ON CONFLICT (student_id, term_code)
          DO UPDATE SET total_score = EXCLUDED.total_score,
                        rank = EXCLUDED.rank,
                        updated_at = now()`,
         [student_id, term_code, total]
     );
    // --- Hết cập nhật term_score ---

    await client.query('COMMIT'); // Lưu tất cả thay đổi
    res.json({ ok: true, total: total }); // Trả về thành công và tổng điểm mới

  } catch (err) {
    await client.query('ROLLBACK'); // Hoàn tác nếu có lỗi
    console.error('Save Self Assessment Error:', err); // Log lỗi chi tiết
    next(err); // Chuyển lỗi cho middleware xử lý lỗi chung
  } finally {
    client.release(); // Luôn trả kết nối về pool
  }
};

export const getStudentHistory = async (req, res, next) => {
  const { student_code } = req.query; // Lấy student_code từ query param

  if (!student_code) {
    return res.status(400).json({ error: 'missing_student_code' });
  }

  try {
    // Truy vấn bảng drl.term_score
    // JOIN với ref.student để lọc theo student_code
    // JOIN với ref.term để có thể sắp xếp theo năm/học kỳ
    const { rows } = await pool.query(
      `
      SELECT
        ts.term_code,      -- Mã học kỳ
        ts.total_score,    -- Tổng điểm kỳ đó
        ts.rank            -- Xếp loại kỳ đó
      FROM drl.term_score ts
      JOIN ref.student s ON ts.student_id = s.id -- Join để lấy student_id
      JOIN ref.term t ON ts.term_code = t.code    -- Join để lấy thông tin năm/kỳ
      WHERE s.student_code = $1                   -- Lọc theo student_code
      ORDER BY
        t.year DESC,      -- Sắp xếp: Năm học mới nhất lên đầu
        t.semester DESC   -- Sắp xếp: Học kỳ lớn hơn lên đầu (HK2 > HK1)
      `,
      [student_code.trim()] // Truyền student_code vào query
    );

    // Trả về kết quả là một mảng các object
    res.json(rows);

  } catch (err) {
    console.error('Get Student History Error:', err);
    next(err); // Chuyển lỗi cho error handler chung
  }
};