import pool from '../db.js';

// Lấy danh sách học kỳ (dành cho dropdown chung)
export const getAllTerms = async (req, res, next) => {
  try {
    // Sắp xếp kỳ mới nhất lên đầu
    const { rows } = await pool.query(
      `SELECT code, title, year, semester, is_active
       FROM ref.term
       ORDER BY year DESC, semester DESC
       Limit 2`
    );
    res.json(rows);
  } catch (err) {
    console.error('Get All Terms Error:', err);
    next(err); // Chuyển lỗi cho error handler
  }
};

// Lấy trạng thái Mở/Khóa đánh giá của một kỳ (dùng cho SelfAssessmentPage)
export const getTermStatus = async (req, res, next) => {
  const { termCode } = req.params;
  try {
    const result = await pool.query('SELECT is_active FROM ref.term WHERE code = $1', [termCode]);
    // Trả về false nếu không tìm thấy term thay vì 404
    if (result.rowCount === 0) {
      return res.json({ isActive: false });
    }
    res.json({ isActive: result.rows[0].is_active });
  } catch (err) {
    console.error("Get Term Status Error:", err);
    // Trả về false nếu có lỗi DB thay vì 500 (an toàn cho frontend)
    res.json({ isActive: false });
  }
};