import pool from "../../db.js";
import {
  getAdSemester,
  postAdSemester,
  putAdSemester,
  deletdeAdSemester,
  putAdSemesterStatus,
} from "../../models/adminModel/semesterMModel.js";

// Cập nhật trạng thái mở/khóa đánh giá cho một học kỳ
export const setTermAssessmentStatus = async (req, res, next) => {
  const { termCode } = req.params;
  const { isOpen } = req.body;

  if (typeof isOpen !== "boolean") {
    return res.status(400).json({ error: "Sai kiểu dữ liệu" });
  }

  try {
    const rows = await putAdSemesterStatus(isOpen, termCode);
    res.json({
      ok: true,
      termCode: rows[0].code,
      isAssessmentOpen: rows[0].is_active,
      message: `Đã ${isOpen ? "mở" : "khóa"} đánh giá cho kỳ ${termCode}.`,
    });
  } catch (error) {
    console.error("Lỗi ở setTermAssessmentStatus", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// Lấy danh sách học kì
export const getAdminTerms = async (req, res) => {
  try {
    const rows = await getAdSemester();
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getAdminTerms", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// Tạo học kỳ mới
export const createAdminTerm = async (req, res, next) => {
  const { code, title, year, semester, start_date, end_date, is_active } =
    req.body;
  console.log(req.body);
  if (
    !code ||
    !title ||
    !year ||
    !semester ||
    !start_date ||
    !end_date ||
    !is_active
  ) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }
  if (![1, 2, 3].includes(semester)) {
    return res.status(400).json({ error: "Học kì không hợp lệ" });
  }
  const checkSmesterInTerm = await pool.query(
    `SELECT 1 FROM ref.term WHERE year = $1 AND semester = $2 LIMIT 1`,
    [year, semester]
  );
  if (checkSmesterInTerm.rowCount > 0) {
    return res.status(409).json({ error: "Kỳ học này đã tồn tại" });
  }

  try {
    const rows = await postAdSemester(
      code,
      title,
      year,
      semester,
      start_date,
      end_date,
      is_active
    );
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Học kì này đã có", detail: error.detail });
    }

    console.error("Lỗi ở createAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// Cập nhật học kỳ
export const updateAdminTerm = async (req, res) => {
  const { termCode } = req.params;
  const { title, year, semester, start_date, end_date, is_active } = req.body;

  if (!title || !year || !semester || !start_date || !end_date || !is_active) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }
  if (![1, 2].includes(semester)) {
    return res.status(400).json({ error: "Học kì không hợp lệ" });
  }

  try {
    const rows = await putAdSemester(
      title,
      year,
      semester,
      start_date,
      end_date,
      is_active,
      termCode
    );
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Lỗi ở updateAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// Xóa học kỳ
export const deleteAdminTerm = async (req, res) => {
  const { termCode } = req.params;

  try {
    const checkUsage = await pool.query(
      `SELECT 1 FROM drl.term_score WHERE term_code = $1 LIMIT 1`,
      [termCode]
    );
    if (checkUsage.rowCount > 0) {
      return res
        .status(400)
        .json({ error: "Không thể xóa học kỳ đã có điểm." });
    }

    await deletdeAdSemester(termCode);
    return res.status(200).json({
      ok: true,
      message: `Học kỳ ${termCode} đã được xóa.`,
    });
  } catch (error) {
    if (error.code === "23503") {
      return res
        .status(400)
        .json({ error: "Không thể xóa học kỳ đã có dữ liệu đánh giá" });
    }
    console.error("Lỗi ở deleteAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};
