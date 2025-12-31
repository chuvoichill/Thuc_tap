import { toNum } from "../../utils/helpers.js";
import {
  deleteCriterion as deleteCriterionModel,
  createCriterion as createCriterionModel,
  updateCriterion as updateCriterionModel,
  updateCriterionOptions as updateCriterionOptionsModel,
  checkCopyCriteria,
  copyCriteria,
  checkStudentAssess,
  deleteAllCriteria,
} from "../../models/adminModel/criteriaMModel.js";

// Tạo mới tiêu chí
export const createCriterion = async (req, res, next) => {
  const { term_code, code, type, title, max_points, group_id, requires_evidence } = req.body || {};

  if (!term_code || !code || !title || !group_id || max_points === null || max_points === undefined) {
    return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc" });
  }
  //kiểm tra đã có sinh viên đánh giá chưa
  const check = await checkStudentAssess(term_code);
    if (check) {
      return res.status(400).json({
        ok: false,
        message: "Không thể tạo vì đã được sinh viên đánh giá",
      });
    }

  try {
    const result = await createCriterionModel(
      term_code.trim(),
      code.trim(),
      title.trim(),
      type,
      max_points,
      group_id,
      requires_evidence || false
    );
    res.status(201).json(result);
  } catch (err) {
    console.error("lỗi ở createCriterion (criteriaController):", err);
    if (err.code === "CRITERION_CODE_EXISTS") {
      return res.status(409).json({ error: "Mã tiêu chí đã tồn tại" });
    }
    next(err);
  }
};

// Update theo ID
export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;
  const { term_code, code, title, type, max_points, group_id, requires_evidence } = req.body || {};

  // Validation đầu vào
  if (!code || !title) {
    return res.status(400).json({ error: "Mã và tiêu đề là bắt buộc" });
  }
  
  //kiểm tra đã có sinh viên đánh giá chưa
  const check = await checkStudentAssess(term_code);
    if (check) {
      return res.status(400).json({
        ok: false,
        message: "Không thể cập nhật vì đã được sinh viên đánh giá",
      });
    }

  try {
    const result = await updateCriterionModel(
      id,
      term_code,
      code.trim(),
      title.trim(),
      type,
      max_points,
      group_id,
      requires_evidence || false
    );
    res.json(result);
  } catch (err) {
    console.error("lỗi ở updateCriterion (criteriaController):", err);
    if( err.code === "CRITERION_NOT_FOUND") { return res.status(404).json({ error: "Không tìm thấy tiêu chí" });}
    if (err.code === "CRITERION_CODE_EXISTS") { return res.status(409).json({ error: "Mã tiêu chí đã tồn tại" });}
    next(err);
  }
};

// Xóa tiêu chí
export const deleteCriterion = async (req, res, next) => {
  const { id, termCode } = req.params;
  if (!id || !termCode) {
    return res.status(400).json({ error: "Thiếu ID hoặc mã kỳ học" });
  }
  // kiểm tra đã có sinh viên đánh giá chưa
  const check = await checkStudentAssess(termCode);
  if (check) {
    return res.status(400).json({
      ok: false,
      message: "Không thể xóa vì đã được sinh viên đánh giá",
    });
  }
  try {
    await deleteCriterionModel(id);
    res.json({ ok: true, message: "Xóa thành công" });
  } catch (err) {
    console.error("lỗi ở Admin Delete Criterion:", err);
    if( err.code === "DELETE_FAIL") { return  res.status(404).json({ error: "Không thể xóa tiêu chí này" });}
    next(err);
  }
};

// Cập nhật options của tiêu chí
export const updateCriterionOptions = async (req, res, next) => {
  const { id } = req.params;
  const { options } = req.body || {};

  try {
    const result = await updateCriterionOptionsModel(toNum(id), options);
    res.json(result);
  } catch (err) {
    console.error("lỗi ở updateCriterionOptions (criteriaController):", err);
    if( err.code === "CRITERION_NOT_FOUND") { return res.status(404).json({ error: "Không tìm thấy tiêu chí" });}
    if (err.code === "CRITERION_NOT_RADIO") { return res.status(400).json({ error: "Tiêu chí không phải là loại radio" });}
    next(err);
  }
};

// Xóa tất cả tiêu chí
export const deleteAllCriteriaAd = async (req, res) => {
  const { termCode } = req.query;

  try {
    const check = await checkStudentAssess(termCode);
    if (check) {
      return res.status(400).json({
        ok: false,
        message: "Không thể xóa vì đã được sinh viên đánh giá",
      });
    }

    await deleteAllCriteria(termCode);
    return res.status(200).json({ ok: true, message: `Đã xóa tiêu chí` });
  } catch (error) {
    console.error("Lỗi ở deleteAllCriteriaAd", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// Sao chép tiêu chí
export const copyCriteriaFromTerm = async (req, res) => {
  const { sourceTermCode, targetTermCode } = req.body;

  if (sourceTermCode === targetTermCode) {
    return res.status(400).json({ error: "Hai kỳ học không thể giống nhau" });
  }

  try {
    // Kiểm tra kì mới đã có dữ liệu chưa
    try {
      await checkCopyCriteria(targetTermCode);
    } catch (err) {
      if (err && err.status === 400 && err.message) {
        console.warn("[copyCriteriaFromTerm] Kỳ đích đã có dữ liệu:", err.message);
        return res.status(400).json({ error: err.message });
      }
      // Các lỗi khác
      console.error("[copyCriteriaFromTerm] Lỗi kiểm tra kỳ đích:", err);
      return res.status(500).json({ error: "Lỗi kiểm tra kỳ đích" });
    }

    // Sao chép dữ liệu
    await copyCriteria(sourceTermCode, targetTermCode);
    res.json({ ok: true });
  } catch (error) {
    console.error("Lỗi ở copyCriteriaFromTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};
