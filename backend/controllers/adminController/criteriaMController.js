import { toNum, parseGroupId } from "../../utils/helpers.js";
import {
  deleteCriterionCascade,
  createCriterion as createCriterionModel,
  updateCriterion as updateCriterionModel,
  updateCriterionOptions as updateCriterionOptionsModel,
  checkCopyCriteria,
  copyCriteria,
  checkdeleteAllCriteria,
  deleteAllCriteria,
} from "../../models/adminModel/criteriaMModel.js";

// --- Criteria Controllers (CRUD Criteria & Options) ---

// Tạo mới tiêu chí
export const createCriterion = async (req, res, next) => {
  const { term_code, code, title, type, max_points, group_id, group_no} = req.body || {};

  // Validation đầu vào
  if (!term_code || !code || !title) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào!" });
  }

  const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";

  // Xác định groupCode để truyền vào model
  const groupCode = group_id || group_no || parseGroupId(code) || "";

  // Thực hiện tạo tiêu chí thông qua model (model xử lý group tự động)
  try {
    const result = await createCriterionModel(
      {
        term_code: term_code.trim(),
        code: code.trim(),
        title: title.trim(),
        type: _type,
        max_points,
      },
      groupCode
    );

    // Trả về dữ liệu tiêu chí đã tạo
    res.status(201).json(result);
  } catch (err) {
    console.error("Admin Create Criterion Error:", err);
    
    if (err.message === "Không thể xác định hoặc tạo nhóm") {
      return res.status(400).json({
        error: "Không thể xác định hoặc tạo nhóm",
        message: err.message,
      });
    }
    if (err.code === "23503") {
      return res.status(400).json({
        error: "Khóa ngoại group_id không hợp lệ",
        detail: err.detail,
      });
    }
    if (err.code === "23505") {
      return res.status(409).json({ 
        error: "Tiêu chí đã tồn tại", 
        detail: "Mã tiêu chí này đã được sử dụng trong kỳ học này",
        suggestion: "Vui lòng sử dụng mã khác hoặc cập nhật tiêu chí hiện có"
      });
    }
    if (err.code === "23502") {
      return res.status(400).json({
        error: "Thiếu trường bắt buộc của tiêu chí",
        detail: err.detail,
      });
    }
    next(err);
  }
};

// Update theo ID
export const updateCriterion = async (req, res, next) => {
  const { id } = req.params;

  // Validation ID
  if (!id) {
    return res.status(400).json({ error: "Thiếu ID tiêu chí" });
  }

  // Lấy dữ liệu mới từ body
  const {
    term_code,
    code,
    title,
    type,
    max_points,
    group_id,
    group_no,
    require_hsv_verify,
  } = req.body || {};

  // Validation đầu vào
  if (!code || !title) {
    return res.status(400).json({ error: "Thiếu mã hoặc tiêu đề tiêu chí" });
  }

  // Validate max_points
  if (max_points !== null && max_points !== undefined) {
    const maxPointsNum = Number(max_points);
    if (
      isNaN(maxPointsNum) ||
      maxPointsNum < 0 ||
      !Number.isInteger(maxPointsNum)
    ) {
      return res.status(400).json({
        error: "Điểm tối đa không hợp lệ",
        message: "Điểm tối đa phải là số nguyên không âm",
      });
    }
  }

  const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";

  // Xác định groupCode để truyền vào model
  const groupCode = group_id || group_no || parseGroupId(code) || "";

  // Thực hiện update thông qua model (model xử lý validation và group tự động)
  try {
    const result = await updateCriterionModel(
      id,
      {
        term_code,
        code: code.trim(),
        title: title.trim(),
        type: _type,
        max_points,
        require_hsv_verify,
      },
      groupCode
    );

    if (!result) {
      return res
        .status(404)
        .json({ error: "Không tìm thấy tiêu chí khi cập nhật" });
    }

    res.json(result);
  } catch (err) {
    console.error("Admin Update Criterion Error:", err);

    // Xử lý lỗi từ model
    if (err.message === "Không tìm thấy tiêu chí!") {
      return res.status(404).json({
        error: "Không tìm thấy tiêu chí để cập nhật",
        message: err.message,
      });
    }
    if (
      err.code ===
      "Không thể thay đổi yêu cầu xác nhận HSV vì đã có sinh viên đánh giá."
    ) {
      const action = require_hsv_verify ? "thêm" : "bỏ";
      return res.status(400).json({
        error: err.code,
        message: err.message,
        assessmentCount: err.assessmentCount,
        suggestion: "Vui lòng xem xét kỹ hoặc tạo tiêu chí mới thay thế.",
      });
    }
    if (err.message === "Không thể xác định hoặc tạo nhóm") {
      return res.status(400).json({
        error: "Không thể xác định hoặc tạo nhóm khi cập nhật",
        message: err.message,
      });
    }
    if (err.code === "23503")
      return res.status(400).json({
        error: "Khóa ngoại group_id không hợp lệ khi cập nhật",
        detail: err.detail,
      });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Trùng mã tiêu chí", detail: err.detail });
    if (err.code === "23502")
      return res.status(400).json({
        error: "Thiếu trường bắt buộc khi cập nhật tiêu chí",
        detail: err.detail,
      });
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
    // Gọi model function để xóa với cascade
    await deleteCriterionCascade(id);

    res.status(200).json({ ok: true, message: "Xóa tiêu chí thành công" });
  } catch (err) {
    console.error("Admin Delete Criterion Error:", err);

    // Xử lý các lỗi cụ thể
    if (err.message === "Không tìm thấy tiêu chí!") {
      return res
        .status(404)
        .json({ error: "Không tìm thấy tiêu chí", message: err.message });
    }
    if (err.code === "23503") {
      return res
        .status(400)
        .json({ error: "Tiêu chí đang được sử dụng", detail: err.detail });
    }

    next(err);
  }
};

// Cập nhật options của tiêu chí
export const updateCriterionOptions = async (req, res, next) => {
  const { id } = req.params;
  const { options } = req.body || {};

  // Validation đầu vào
  if (!id || !Array.isArray(options)) {
    return res
      .status(400)
      .json({ error: "Thiếu ID tiêu chí hoặc danh sách tùy chọn" });
  }

  const criterion_id = toNum(id);
  if (!criterion_id) {
    return res.status(400).json({ error: "ID tiêu chí không hợp lệ" });
  }

  // Gọi model function xử lý toàn bộ logic (validation + transaction)
  try {
    const result = await updateCriterionOptionsModel(
      criterion_id,
      options
    );
    res.json(result);
  } catch (err) {
    console.error("Admin Update Options Error:", err);

    // Xử lý các lỗi cụ thể từ model
    if (
      err.message === "Không tìm thấy tiêu chí!" ||
      err.message === "Tiêu chí không phải là radio!"
    ) {
      return res.status(404).json({ error: err.message, message: err.message });
    } else if (err.message === "Tiêu chí radio yêu cầu có các tùy chọn") {
      return res.status(400).json({
        error: err.message,
        message: err.message,
      });
    } else if (err.message === "Điểm của tùy chọn không được âm") {
      return res.status(400).json({
        error: err.message,
        message: err.message,
      });
    } else if (err.message === "Điểm của tùy chọn vượt quá điểm tối đa") {
      return res.status(400).json({
        error: err.message,
        message: err.message,
      });
    } else {
      next(err);
    }
  }
};

// Xóa tất cả tiêu chí
export const deleteAllCriteriaAd = async (req, res) => {
  const { termCode } = req.query;
  console.log(termCode);
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
  // Kiểm tra đầu vào cơ bản
  if (!sourceTermCode || !targetTermCode) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }
  if (sourceTermCode === targetTermCode) {
    return res.status(400).json({ error: "Hai kì học không thể giống nhau" });
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
