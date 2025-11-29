import pool from "../db.js";
import { toNum, parseGroupId, getConfig } from "../utils/helpers.js";
import { getSearchClassStudents } from "../models/adminModel/searchMModel.js";
import {
  getGroupCri,
  postGroupCri,
  putGroupCri,
  deleteGroupCri,
} from "../models/adminModel/groupMModel.js";
import {
  deleteCriterionCascade,
  upsertCriterionWithGroup,
  updateCriterionWithGroupAndValidation,
  updateCriterionOptionsWithValidation,
} from "../models/adminModel/criteriaMModel.js";

import {
  getAdSemester,
  postAdSemester,
  putAdSemester,
  deletdeAdSemester,
  putAdSemesterStatus,
} from "../models/adminModel/semesterMModel.js";
import {
  getClass,
  getfaculty,
  getStudent,
} from "../models/adminModel/faculty_classMModel.js";

// --- Controllers ---

//Lấy danh sách khoa
export const getFaculties = async (req, res, next) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getfaculty(term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getfaculty", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

//Lấy danh sách lớp
export const getClasses = async (req, res) => {
  const { term, faculty } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getClass(term, faculty);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getClasses", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

//Lấy danh sách sinh viên
export const getClassStudents = async (req, res, next) => {
  const { class_code, term } = req.query || {};
  if (!class_code || !term)
    return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getStudent(class_code, term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getClassStudents", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// --- Group Controllers (CRUD Groups) ---
//Lấy danh sách Group
export const getGroups = async (req, res) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không tìm thấy năm học" });

  try {
    const rows = await getGroupCri(term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getGroups", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Tạo mới Group
export const createGroup = async (req, res) => {
  // Cần term_code, code, title từ body
  const { term_code, code, title } = req.body;
  if (!term_code || !code || !title)
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });

  try {
    const rows = await postGroupCri(term_code, code, title);
    res.status(201).json(rows[0]);
  } catch (error) {
    console.error("Lỗi ở createGroup:", error); 
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Trùng dữ liệu", detail: error.detail });
    }
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Cập nhật Group
export const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { code, title } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }

  try {
    const rows = await putGroupCri(id, code, title);
    res.status(200).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res
        .status(409)
        .json({ error: "Trùng dữ liệu", detail: error.detail });
    }

    console.error("Lỗi ở updateGroup", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// Xóa Group
export const deleteGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await deleteGroupCri(id);
    res.status(200).json({
      ok: true,
      message: "Nhóm tiêu chí đã được xóa.",
      deletde: rows[0],
    });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Lỗi ở deleteGroup", error);
    res.status(500).send({ message: "Lỗi hệ thống" });
  }
};

// --- Criteria Controllers (CRUD Criteria & Options) ---

// Tạo mới (hoặc Upsert - tùy logic bạn muốn)
export const createOrUpdateCriterion = async (req, res, next) => {
  const {term_code, code, title, type, max_points, group_id,group_no} = req.body || {};
  
  // Validation đầu vào
  if (!term_code || !code || !title) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào!" });
  }

  const _type = ["radio", "text", "auto"].includes(type) ? type : "radio";

  // Xác định groupCode để truyền vào model
  const groupCode = group_id || group_no || parseGroupId(code) || "";

  // Thực hiện upsert tiêu chí thông qua model (model xử lý group tự động)
  try {
    const result = await upsertCriterionWithGroup(
      {
        term_code: term_code.trim(),
        code: code.trim(),
        title: title.trim(),
        type: _type,
        max_points
      },
      groupCode
    );

    // Trả về dữ liệu tiêu chí đã lưu
    res.status(201).json(result);
  } catch (err) {
    console.error("Admin Create/Update Criterion Error:", err);
    if (err.message === "Không thể xác định hoặc tạo nhóm") {
      return res.status(400).json({
        error: "Không thể xác định hoặc tạo nhóm",
        message: err.message,
      });
    }
    if (err.code === "23503")
      return res.status(400).json({
        error: "Khóa ngoại group_id không hợp lệ",
        detail: err.detail,
      });
    if (err.code === "23505")
      return res
        .status(409)
        .json({ error: "Trùng mã tiêu chí", detail: err.detail });
    if (err.code === "23502")
      return res.status(400).json({
        error: "Thiếu trường bắt buộc của tiêu chí",
        detail: err.detail,
      });
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
    const result = await updateCriterionWithGroupAndValidation(
      id,
      {
        term_code,
        code: code.trim(),
        title: title.trim(),
        type: _type,
        max_points,
        require_hsv_verify
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
    const result = await updateCriterionOptionsWithValidation(
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

//hhhhhhhhhhhhhhhhhhh
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

//Lấy danh sách học kì
export const getAdminTerms = async (req, res) => {
  try {
    const rows = await getAdSemester();
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getAdminTerms", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

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

export const deleteAdminTerm = async (req, res) => {
  const { termCode } = req.params; // Lấy mã kỳ từ URL

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

    const rows = await deletdeAdSemester(termCode);
    return res.status(200).json({
      ok: true,
      message: `Học kỳ ${termCode} đã được xóa.`,
      delete: rows[0],
    });
  } catch (error) {
    if (error.code === "23503") {
      // Lỗi Foreign Key Violation
      return res
        .status(400)
        .json({ error: "Không thể xóa học kỳ đã có dữ liệu đánh giá" });
    }
    console.error("Lỗi ở deleteAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

// --- THÊM HÀM MỚI ĐỂ SAO CHÉP TIÊU CHÍ ---
export const copyCriteriaFromTerm = async (req, res, next) => {
  const { sourceTermCode, targetTermCode } = req.body;
  // Kiểm tra đầu vào cơ bản
  if (!sourceTermCode || !targetTermCode) {
    return res.status(400).json({ error: "missing_source_or_target_term" });
  }
  if (sourceTermCode === targetTermCode) {
    return res.status(400).json({ error: "source_and_target_cannot_be_same" });
  }

  try {
    //Kiểm tra bảng criteria_group đã có dữ liệu của kì đích chưa
    const isTargetTermCodeInCriteria_group = await pool.query(
      `select 1
      from drl.criteria_group 
      where term_code = $1`,
      [targetTermCode]
    );

    if (isTargetTermCodeInCriteria_group != 0) {
      return res
        .status(400)
        .json({ error: "Kì đích đã có dữ liệu nên không thể sao chép" });
    }

    if (isTargetTermCodeInCriteria_group.rowCount == 0) {
      //Sao chép kì đích sang kì nguồn bảng criteria_group
      await pool.query(
        `insert into drl.criteria_group (term_code, code, title)
        select $1, code, title
        from drl.criteria_group where term_code=$2`,
        [targetTermCode, sourceTermCode]
      );
    }

    //Kiểm tra bảng criterion đã có dữ liệu của kì đích chưa
    const isTargetTermCodeInCriterion = await pool.query(
      `select 1
      from drl.criterion 
      where term_code = $1`,
      [targetTermCode]
    );
    if (isTargetTermCodeInCriterion.rowCount == 0) {
      //Lấy id của kì đích trong bảng criteria_group
      const idTargetTermCode = await pool.query(
        `select id
        from drl.criteria_group cg
        where cg.term_code = $1`,
        [targetTermCode]
      );

      // 6. Chèn (INSERT) tiêu chí mới vào kỳ đích
      try {
        // Câu lệnh INSERT tiêu chí
        const insertCritQuery = `
                    INSERT INTO drl.criterion
                        (term_code, group_id, code, title, type, max_points, calc_method)
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    RETURNING id`; // Trả về ID của tiêu chí mới
        // Tham số cho câu lệnh INSERT
        const critParams = [
          targetTermCode,
          newGroupId, // ID nhóm mới (có thể là null nếu cột cho phép)
          oldCrit.code,
          oldCrit.title,
          oldCrit.type,
          oldCrit.max_points,
          oldCrit.calc_method,
        ];
        console.log(
          "[DEBUG CopyCriteria] Inserting criterion:",
          insertCritQuery,
          critParams
        );
        // Thực thi INSERT
        const newCritRes = await client.query(insertCritQuery, critParams);
        const newCriterionId = newCritRes.rows[0].id; // Lấy ID của tiêu chí mới
        console.log(
          `[DEBUG CopyCriteria] Successfully inserted criterion. New Criterion ID: ${newCriterionId}`
        );
        //Sao chép kì nguồn đến kì đích trong bảng criterion
        await pool.query(
          `insert into drl.criterion (term_code, group_id, code, title, type, max_points, display_order, require_hsv_verify)
          select $1, $2, code, title, type, max_points, display_order, require_hsv_verify
          from drl.criterion where group_id = $3`,
          [targetTermCode, element.id, idSourceTermCode.rows[0].id]
        );
      }
    }

    const idTargetTermCode = await pool.query(
      `select id from drl.criterion 
      where term_code = $1`,
      [targetTermCode]
    );
    console.log("idTarget", idTargetTermCode.rows);
    for (const element of idTargetTermCode.rows) {
      const idSourceTermCode = await pool.query(
        `select id from drl.criterion
        where term_code=$1 and title=(select title from drl.criterion
        where id=$2)`,
        [sourceTermCode, element.id]
      );
      console.log("idSource", idSourceTermCode.rows);
      await pool.query(
        `insert into drl.criterion_option (criterion_id, label, score, display_order)
        select $1, label, score, display_order
        from drl.criterion_option
        where criterion_id = $2`,
        [element.id, idSourceTermCode.rows[0].id]
      );
    }

    // Trả về kết quả thành công
    res.json({ ok: true });
  } catch (err) {
    if (err.code) {
      // Check if it's a PostgreSQL error object
      console.error("--- Failing Query Hint ---");
      console.error("Error Code:", err.code);
      console.error("Error Detail:", err.detail);
      console.error("Error Constraint:", err.constraint);
      console.error("------------------------");
    }
    // Chuyển lỗi cho middleware xử lý lỗi chung
    next(err);
  }
};

export const searchClass = async (req, res) => {
  const student = req.query;
  if (!student || student.length === 0) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }
  try {
    const search = await getSearchClassStudents(student);
    res.json(search);
  } catch (error) {
    console.error("Lỗi ở searchClass", error);
    res.status(500).json({ error: "Lỗi hệ thống", detail: error.message });
  }
};

// --- HẾT THAY THẾ ---
