import { toNum } from "../../utils/helpers.js";
import {
  deleteCriterion as deleteCriterionModel,
  createCriterion as createCriterionModel,
  updateCriterion as updateCriterionModel,
  updateCriterionOptions as updateCriterionOptionsModel,
  checkCopyCriteria,
  copyCriteria,
  checkdeleteAllCriteria,
  deleteAllCriteria,
} from "../../models/adminModel/criteriaMModel.js";

// Tạo mới tiêu chí
export const createCriterion = async (req, res, next) => {
  const { term_code, code, type, title, max_points, group_code, requires_evidence } = req.body || {};
 
 if (!term_code || !code || !title || !group_code || max_points === null || max_points === undefined) {
  return res.status(400).json({ error: "Thiếu dữ liệu bắt buộc" });
}

  try {
    const result = await createCriterionModel(
      term_code.trim(),
      code.trim(),
      title.trim(),
      type,
      max_points,
      group_code,
      requires_evidence || false
    );

    res.status(201).json(result);
  } catch (err) {
    console.error("lỗi ở createCriterion (criteriaController):", err);
    
    if (err.code === "23505") {
      return res.status(409).json({ error: "Mã tiêu chí đã tồn tại" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ error: "Tham chiếu không hợp lệ" });
    }
    
    next(err);
  }
};

// Update theo ID
export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;
  const { term_code, code, title, type, max_points, group_code, requires_evidence } = req.body || {};

  // Validation đầu vào
  if (!code || !title) {
    return res.status(400).json({ error: "Mã và tiêu đề là bắt buộc" });
  }

  try {
    const result = await updateCriterionModel(
      id,
      term_code,
      code.trim(),
      title.trim(),
      type,
      max_points,
      group_code,
      requires_evidence || false
    );

    res.json(result);
  } catch (err) {
    console.error("lỗi ở updateCriterion (criteriaController):", err);

    if (err.message === "Không tìm thấy tiêu chí") {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "23505") {
      return res.status(409).json({ error: "Mã tiêu chí đã tồn tại" });
    }
    if (err.code === "23503") {
      return res.status(400).json({ error: "Tham chiếu không hợp lệ" });
    }
   next(err);
  }
};

// Xóa tiêu chí
export const deleteCriterion = async (req, res, next) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Thiếu ID tiêu chí" });
  }

  try {
    await deleteCriterionModel(id);
    res.json({ ok: true, message: "Xóa thành công" });
  } catch (err) {
    console.error("lỗi ở Admin Delete Criterion:", err);

    if (err.message === "Không tìm thấy tiêu chí") {
      return res.status(404).json({ error: err.message });
    }
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

    if (err.message === "Không tìm thấy tiêu chí" || err.message === "Tiêu chí không phải là radio") {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
};

// Xóa tất cả tiêu chí
export const deleteAllCriteriaAd = async (req, res) => {
  const { termCode } = req.query;

  try {
    const check = await checkdeleteAllCriteria(termCode);
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
    //Kiểm tra kì mới đã có dữ liệu chưa
    await checkCopyCriteria(targetTermCode);

    //Sao chép dữ liệu
    await copyCriteria(sourceTermCode, targetTermCode);
    res.json({ ok: true });
  } catch (error) {
    console.error("Lỗi ở copyCriteriaFromTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};
