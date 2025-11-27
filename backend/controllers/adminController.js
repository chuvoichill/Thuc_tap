import pool from "../db.js";
import { toNum, parseGroupId, getConfig,} from "../utils/helpers.js";
import { getSearchClassStudents } from "../models/adminModel/searchMModel.js";
import { getGroupCri, postGroupCri, putGroupCri, deleteGroupCri } from "../models/adminModel/groupMModel.js";
import { deleteCriterionCascade, upsertCriterionWithGroup, updateCriterionWithGroupAndValidation, updateCriterionOptionsWithValidation
} from '../models/adminModel/criteriaMModel.js';

import { getAdSemester, postAdSemester, putAdSemester, deletdeAdSemester, putAdSemesterStatus } from "../models/adminModel/semesterMModel.js";
import { getClass, getfaculty, getStudent } from "../models/adminModel/faculty_classMModel.js";

// --- Controllers ---

//Lấy danh sách khoa
export const getFaculties = async (req, res, next) => {
  const { term } = req.query || {};
  if (!term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows  = await getfaculty(term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getfaculty", error);
    res.status(500).send({message: "Lỗi hệ thống"});
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
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

//Lấy danh sách sinh viên
export const getClassStudents = async (req, res, next) => {
  const { class_code, term } = req.query || {};
  if (!class_code || !term) return res.status(400).json({ error: "Không có kì học" });

  try {
    const rows = await getStudent(class_code,term);
    res.json(rows);
  } catch (error) {
    console.error("Lỗi ở getClassStudents", error);
    res.status(500).send({message: "Lỗi hệ thống"});
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
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

// Tạo mới Group
export const createGroup = async (req, res) => {
  // Cần term_code, code, title từ body
  const { term_code, code, title } = req.body;
  if (!term_code || !code || !title) return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });

  try {
    const rows = await postGroupCri(term_code, code, title);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Trùng dữ liệu", detail: error.detail });
    }
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

// Cập nhật Group
export const updateGroup = async (req, res) => {
  const { id } = req.params;
  const { code, title} = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }

  try {
    const rows = await putGroupCri(id,code, title);
    res.status(200).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Trùng dữ liệu", detail: error.detail });
    }

    console.error("Lỗi ở updateGroup",error );
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

// Xóa Group
export const deleteGroup = async (req, res) => {
  const { id } = req.params;

  try {
    const rows = await deleteGroupCri(id);
    res.status(200).json({ ok: true, message: "Nhóm tiêu chí đã được xóa.", deletde:rows[0] });
  } catch (error) {
    if (error.status === 400) {
      return res.status(400).json({ error: error.message });
    }

    console.error("Lỗi ở deleteGroup",error);
    res.status(500).send({message: "Lỗi hệ thống"});
  }
};

// --- Criteria Controllers (CRUD Criteria & Options) ---

// Tạo mới (hoặc Upsert - tùy logic bạn muốn)
export const createOrUpdateCriterion = async (req, res, next) => {
  const {term_code, code, title, type, max_points, display_order, group_id,group_no} = req.body || {};
  
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
        max_points,
        display_order
      },
      groupCode
    );
    
    // Trả về dữ liệu tiêu chí đã lưu
    res.status(201).json(result);
  } catch (err) {
    console.error("Admin Create/Update Criterion Error:", err);
    if (err.message === "Không thể xác định hoặc tạo nhóm") {
      return res.status(400).json({ error: "Không thể xác định hoặc tạo nhóm", message: err.message });
    }
    if (err.code === "23503")
      return res.status(400).json({ error: "Khóa ngoại group_id không hợp lệ", detail: err.detail });
    if (err.code === "23505")
      return res.status(409).json({ error: "Trùng mã tiêu chí", detail: err.detail });
    if (err.code === "23502")
      return res.status(400).json({ error: "Thiếu trường bắt buộc của tiêu chí", detail: err.detail });
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
    display_order,
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
    if (isNaN(maxPointsNum) || maxPointsNum < 0 || !Number.isInteger(maxPointsNum)) {
      return res.status(400).json({ 
        error: "Điểm tối đa không hợp lệ",
        message: "Điểm tối đa phải là số nguyên không âm" 
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
        display_order,
        require_hsv_verify
      },
      groupCode
    );

    if (!result) {
      return res.status(404).json({ error: "Không tìm thấy tiêu chí khi cập nhật" });
    }
    
    res.json(result);
  } catch (err) {
    console.error("Admin Update Criterion Error:", err);
    
    // Xử lý lỗi từ model
    if (err.message === "Không tìm thấy tiêu chí!") {
      return res.status(404).json({ error: "Không tìm thấy tiêu chí để cập nhật", message: err.message });
    }
    if (err.code === "Không thể thay đổi yêu cầu xác nhận HSV vì đã có sinh viên đánh giá.") {
      const action = require_hsv_verify ? 'thêm' : 'bỏ';
      return res.status(400).json({
        error: err.code,
        message: err.message,
        assessmentCount: err.assessmentCount,
        suggestion: "Vui lòng xem xét kỹ hoặc tạo tiêu chí mới thay thế."
      });
    }
    if (err.message === "Không thể xác định hoặc tạo nhóm") {
      return res.status(400).json({ error: "Không thể xác định hoặc tạo nhóm khi cập nhật", message: err.message });
    }
    if (err.code === "23503")
      return res.status(400).json({ error: "Khóa ngoại group_id không hợp lệ khi cập nhật", detail: err.detail });
    if (err.code === "23505")
      return res.status(409).json({ error: "Trùng mã tiêu chí", detail: err.detail });
    if (err.code === "23502")
      return res.status(400).json({ error: "Thiếu trường bắt buộc khi cập nhật tiêu chí", detail: err.detail });
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
      return res.status(404).json({ error: "Không tìm thấy tiêu chí", message: err.message });
    }
    if (err.code === "23503") {
      return res.status(400).json({ error: "Tiêu chí đang được sử dụng", detail: err.detail });
    }
    
    next(err);
  }
};

export const updateCriterionOptions = async (req, res, next) => {
  const { id } = req.params;
  const { options } = req.body || {};
  
  // Validation đầu vào
  if (!id || !Array.isArray(options)) {
    return res.status(400).json({ error: "Thiếu ID tiêu chí hoặc danh sách tùy chọn" });
  }
  
  const criterion_id = toNum(id);
  if (!criterion_id) {
    return res.status(400).json({ error: "ID tiêu chí không hợp lệ" });
  }

  // Gọi model function xử lý toàn bộ logic (validation + transaction)
  try {
    const result = await updateCriterionOptionsWithValidation(criterion_id, options);
    res.json(result);
    
  } catch (err) {
    console.error("Admin Update Options Error:", err);
    
    // Xử lý các lỗi cụ thể từ model
    if (err.message === "Không tìm thấy tiêu chí!" || err.message === "Tiêu chí không phải là radio!") {
      return res.status(404).json({ error: err.message, message: err.message });
    } else if (err.message === "Tiêu chí radio yêu cầu có các tùy chọn") {
      return res.status(400).json({ 
        error: err.message,
        message: err.message
      });
    } else if (err.message === "Điểm của tùy chọn không được âm") {
      return res.status(400).json({ 
        error: err.message,
        message: err.message
      });
    } else if (err.message === "Điểm của tùy chọn vượt quá điểm tối đa") {
      return res.status(400).json({ 
        error: err.message,
        message: err.message
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
    const rows = await putAdSemesterStatus(isOpen,termCode);
    res.json({ok: true,termCode: rows[0].code,isAssessmentOpen: rows[0].is_active,
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
  const { code, title, year, semester, start_date, end_date, is_active } = req.body;
  console.log(req.body);
  if (!code || !title || !year || !semester || !start_date || !end_date || !is_active) {
    return res.status(400).json({ error: "Thiếu dữ liệu đầu vào" });
  }
  if (![1, 2, 3].includes(semester)) {
    return res.status(400).json({ error: "Học kì không hợp lệ" });
  }
  const checkSmesterInTerm = await pool.query(`SELECT 1 FROM ref.term WHERE year = $1 AND semester = $2 LIMIT 1`,[year, semester]);
  if (checkSmesterInTerm.rowCount > 0) {
    return res.status(409).json({error: "Kỳ học này đã tồn tại",});
  }

  try {
    const rows = await postAdSemester(code, title, year, semester, start_date, end_date, is_active);
    res.status(201).json(rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Học kì này đã có", detail: error.detail });
    }
    
    console.error("Lỗi ở createAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

export const updateAdminTerm = async (req, res) => {
  const { termCode } = req.params;
  const {title, year,semester,start_date, end_date, is_active} = req.body;

  if (!title || !year || !semester || !start_date || !end_date || !is_active) {
    return res.status(400).json({ error: "Thiếu dữ liệu" });
  }
  if (![1, 2].includes(semester)) {
    return res.status(400).json({ error: "Học kì không hợp lệ" });
  }
  
  try {
    const rows = await putAdSemester(title, year, semester, start_date, end_date, is_active, termCode);
    res.status(200).json(rows[0]);
  } catch (error) {
    console.error("Lỗi ở updateAdminTerm", error);
    return res.status(500).json({ error: "Lỗi hệ thống" });
  }
};

export const deleteAdminTerm = async (req, res) => {
  const { termCode } = req.params; // Lấy mã kỳ từ URL

  try {
    const checkUsage = await pool.query(`SELECT 1 FROM drl.term_score WHERE term_code = $1 LIMIT 1`, [termCode]);
    if (checkUsage.rowCount > 0) {
      return res.status(400).json({ error:'Không thể xóa học kỳ đã có điểm.' });
    }

    const rows = await deletdeAdSemester(termCode);
    return res.status(200).json({ ok: true, message: `Học kỳ ${termCode} đã được xóa.`,delete:rows[0]});
  } catch (error) {
    if (error.code === "23503") {
      // Lỗi Foreign Key Violation
      return res.status(400).json({ error: "Không thể xóa học kỳ đã có dữ liệu đánh giá", });
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

  // Lấy cấu hình CSDL
  const {
    GROUP_TBL,
    OPT_SCORE_COL,
    OPT_ORDER_COL,
    HAS_GROUP_ID,
    GROUP_ID_NOT_NULL,
  } = getConfig();
  console.log("[DEBUG CopyCriteria] Config:", {
    GROUP_TBL,
    OPT_SCORE_COL,
    OPT_ORDER_COL,
    HAS_GROUP_ID,
    GROUP_ID_NOT_NULL,
  });
  // Dừng sớm nếu tên bảng group không hợp lệ
  if (!GROUP_TBL) {
    console.error(
      "CRITICAL ERROR in copyCriteriaFromTerm: GROUP_TBL is undefined or null!"
    );
    return next(
      new Error(
        "Internal server configuration error: Group table name is missing."
      )
    );
  }

  const client = await pool.connect(); // Lấy một kết nối từ pool

  try {
    await client.query("BEGIN"); // Bắt đầu transaction chính

    // 1. Kiểm tra xem kỳ đích đã có tiêu chí chưa
    const checkExisting = await client.query(
      "SELECT 1 FROM drl.criterion WHERE term_code = $1 LIMIT 1",
      [targetTermCode]
    );
    if (checkExisting.rowCount > 0) {
      await client.query("ROLLBACK"); // Hoàn tác transaction
      return res.status(409).json({
        error: "target_term_already_has_criteria",
        message: `Kỳ ${targetTermCode} đã có tiêu chí. Không thể sao chép.`,
      });
    }

    // 2. Lấy tất cả tiêu chí, thông tin nhóm cũ, và các options từ kỳ nguồn
    const sourceCriteriaQuery = `
            SELECT
                c.*,
                COALESCE(g.code, '') AS group_code,
                COALESCE(g.title, '') AS group_title,
                COALESCE((
                    SELECT json_agg(o ORDER BY ${
                      OPT_ORDER_COL ? `o.${OPT_ORDER_COL}` : "o.id"
                    })
                    FROM drl.criterion_option o
                    WHERE o.criterion_id = c.id
                ), '[]'::json) AS options
            FROM drl.criterion c
            LEFT JOIN ${GROUP_TBL} g ON g.id = c.group_id
            WHERE c.term_code = $1
            ORDER BY c.id`; // Sắp xếp để đảm bảo thứ tự nhất quán
    console.log("[DEBUG CopyCriteria] Getting source criteria...");
    const sourceCriteriaRes = await client.query(sourceCriteriaQuery, [
      sourceTermCode,
    ]);
    const sourceCriteria = sourceCriteriaRes.rows;
    console.log(
      `[DEBUG CopyCriteria] Found ${sourceCriteria.length} criteria in source term ${sourceTermCode}.`
    );
    // Kiểm tra nếu kỳ nguồn không có tiêu chí
    if (sourceCriteria.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({
        error: "no_criteria_in_source_term",
        message: `Kỳ ${sourceTermCode} không có tiêu chí nào để sao chép.`,
      });
    }

    const groupMap = new Map(); // Map lưu trữ: mã_nhóm_cũ -> id_nhóm_mới_ở_kỳ_đích
    let copiedCount = 0; // Đếm số tiêu chí sao chép thành công
    let skippedCount = 0; // Đếm số tiêu chí bị bỏ qua

    // 3. Lặp qua từng tiêu chí nguồn
    for (const oldCrit of sourceCriteria) {
      console.log(
        `\n[DEBUG CopyCriteria] Processing criterion ID ${oldCrit.id}, Code: ${oldCrit.code}, Source Group Code: '${oldCrit.group_code}', Source Group Title: '${oldCrit.group_title}'`
      );
      let newGroupId = null; // ID của nhóm trong kỳ đích

      // 4. Xử lý ID nhóm mới (chỉ khi cần thiết)
      if (HAS_GROUP_ID && oldCrit.group_code) {
        // Chỉ xử lý nếu bảng criterion có cột group_id và tiêu chí cũ có mã nhóm
        console.log(
          `[DEBUG CopyCriteria] Group processing needed. Source Group Code: ${oldCrit.group_code}`
        );
        // Kiểm tra xem đã xử lý mã nhóm này chưa
        if (groupMap.has(oldCrit.group_code)) {
          newGroupId = groupMap.get(oldCrit.group_code);
          console.log(
            `[DEBUG CopyCriteria] Found existing mapped Group ID for code ${oldCrit.group_code}: ${newGroupId}`
          );
        } else {
          // Nếu chưa, thử tìm hoặc tạo nhóm mới trong kỳ đích
          const groupTitle =
            oldCrit.group_title || `Nhóm ${oldCrit.group_code}`; // Lấy title cũ hoặc tạo title mặc định
          console.log(
            `[DEBUG CopyCriteria] Group ID not mapped. Trying to find/create group for code ${oldCrit.group_code}, title "${groupTitle}" in target term ${targetTermCode}`
          );

          let foundOrCreatedId = null;
          try {
            // Sử dụng SAVEPOINT để cô lập việc tạo/tìm nhóm
            await client.query("SAVEPOINT find_create_group");

            // --- ĐÂY LÀ PHẦN ĐÃ SỬA ---
            // Liệt kê TẤT CẢ cột NOT NULL (trừ id tự tăng)
            const insertGroupQuery = `
                            INSERT INTO ${GROUP_TBL}
                                (term_code, code, title, max_points, display_order)
                            VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (term_code, code) DO NOTHING
                            RETURNING id`;

            // Cung cấp giá trị mặc định cho các cột NOT NULL
            const groupOrder =
              parseInt(String(oldCrit.group_code || "").replace(/\D/g, "")) ||
              99; // Lấy số từ code làm thứ tự
            const insertParams = [
              targetTermCode, // $1: term_code
              oldCrit.group_code, // $2: code (ví dụ: '1')
              groupTitle, // $3: title (ví dụ: 'Nhóm 1')
              0, // $4: Giá trị mặc định cho max_points
              groupOrder, // $5: Giá trị mặc định cho display_order
            ];
            // --- HẾT PHẦN SỬA ---

            console.log(
              "[DEBUG CopyCriteria] Attempting INSERT group:",
              insertGroupQuery,
              insertParams
            ); // Log kiểm tra
            const groupRes = await client.query(insertGroupQuery, insertParams); // Thực thi INSERT

            if (groupRes.rowCount > 0) {
              // Nếu INSERT thành công (không bị conflict)
              foundOrCreatedId = groupRes.rows[0].id;
              console.log(
                `[DEBUG CopyCriteria] Successfully INSERTED new group. New Group ID: ${foundOrCreatedId}`
              );
            } else {
              // Nếu INSERT bị conflict (rowCount=0) -> nhóm đã tồn tại
              console.log(
                `[DEBUG CopyCriteria] Group likely exists. Attempting SELECT.`
              );
              const selectGroupQuery = `SELECT id FROM ${GROUP_TBL} WHERE term_code = $1 AND code = $2`;
              console.log(
                "[DEBUG CopyCriteria] Selecting existing group:",
                selectGroupQuery,
                [targetTermCode, oldCrit.group_code]
              );
              const selectRes = await client.query(selectGroupQuery, [
                targetTermCode,
                oldCrit.group_code,
              ]); // Query lại để lấy ID

              if (selectRes.rowCount > 0) {
                // Nếu tìm thấy
                foundOrCreatedId = selectRes.rows[0].id;
                console.log(
                  `[DEBUG CopyCriteria] Successfully SELECTED existing group. Existing Group ID: ${foundOrCreatedId}`
                );
              } else {
                // Trường hợp hiếm: Không INSERT được và cũng không SELECT được
                console.error(
                  `[DEBUG CopyCriteria] CRITICAL: Failed to INSERT and SELECT group ${oldCrit.group_code} for term ${targetTermCode}.`
                );
                await client.query("ROLLBACK TO SAVEPOINT find_create_group"); // Hoàn tác SAVEPOINT
                // Giữ foundOrCreatedId là null
              }
            }
            // Nếu tìm hoặc tạo thành công, giải phóng SAVEPOINT
            if (foundOrCreatedId) {
              await client.query("RELEASE SAVEPOINT find_create_group");
            }
          } catch (groupError) {
            // Nếu có lỗi trong quá trình tạo/tìm nhóm
            console.error(
              `[DEBUG CopyCriteria] Error during find/create group ${oldCrit.group_code}:`,
              groupError
            );
            await client.query("ROLLBACK TO SAVEPOINT find_create_group"); // Hoàn tác SAVEPOINT
            // Giữ foundOrCreatedId là null
          }

          // Gán ID tìm/tạo được cho newGroupId và cập nhật map
          if (foundOrCreatedId) {
            newGroupId = foundOrCreatedId;
            groupMap.set(oldCrit.group_code, newGroupId); // Lưu vào map để tái sử dụng
            console.log(
              `[DEBUG CopyCriteria] Mapped source group code ${oldCrit.group_code} to new Group ID ${newGroupId}`
            );
          } else {
            console.warn(
              `[DEBUG CopyCriteria] Failed to find or create group for code ${oldCrit.group_code}. newGroupId remains null.`
            );
          }
        } // Kết thúc else (tìm/tạo nhóm mới)
      } else if (HAS_GROUP_ID) {
        // Trường hợp bảng có cột group_id nhưng tiêu chí nguồn không có group_code
        console.log(
          `[DEBUG CopyCriteria] No group processing needed (Source Group Code is missing?). oldCrit.group_code: '${oldCrit.group_code}'`
        );
      } // Kết thúc xử lý group

      // 5. Kiểm tra group_id trước khi INSERT tiêu chí
      // Nếu cột group_id yêu cầu NOT NULL mà không xác định được newGroupId -> Bỏ qua
      if (
        HAS_GROUP_ID &&
        GROUP_ID_NOT_NULL &&
        newGroupId === null &&
        oldCrit.group_code
      ) {
        console.warn(
          `---> SKIPPING criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) because required Group ID could not be determined for source group code '${oldCrit.group_code}'.`
        );
        skippedCount++; // Tăng biến đếm bỏ qua
        continue; // Chuyển sang tiêu chí tiếp theo trong vòng lặp
      } else if (HAS_GROUP_ID && newGroupId === null && oldCrit.group_code) {
        // Ghi log nếu group_id cho phép NULL nhưng không tìm/tạo được group
        console.warn(
          `---> Proceeding to insert criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) with NULL group_id because column is nullable, even though group processing failed for source code '${oldCrit.group_code}'.`
        );
      } else if (HAS_GROUP_ID && newGroupId === null && !oldCrit.group_code) {
        // Ghi log nếu group_id cho phép NULL và tiêu chí nguồn không có group_code
        console.log(
          `---> Proceeding to insert criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) with NULL group_id (source had no group code).`
        );
      }

      // 6. Chèn (INSERT) tiêu chí mới vào kỳ đích
      try {
        // Câu lệnh INSERT tiêu chí
        const insertCritQuery = `
                    INSERT INTO drl.criterion
                        (term_code, group_id, code, title, type, max_points, calc_method, display_order)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
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
          oldCrit.display_order,
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
        copiedCount++; // Tăng biến đếm thành công

        // 7. Chèn (INSERT) các lựa chọn (options) cho tiêu chí mới (nếu có)
        if (oldCrit.options && oldCrit.options.length > 0) {
          console.log(
            `[DEBUG CopyCriteria] Inserting ${oldCrit.options.length} options for new criterion ID ${newCriterionId}`
          );
          // Xác định tên cột điểm và thứ tự từ config
          const optCols = ["criterion_id", "label", OPT_SCORE_COL];
          const optValuePlaceholders = ["$1", "$2", "$3"];
          if (OPT_ORDER_COL) {
            // Chỉ thêm cột thứ tự nếu nó tồn tại
            optCols.push(OPT_ORDER_COL);
            optValuePlaceholders.push("$4");
          }
          // Tạo câu lệnh INSERT option mẫu
          const optQuery = `INSERT INTO drl.criterion_option (${optCols.join(
            ", "
          )}) VALUES (${optValuePlaceholders.join(", ")})`;
          // Chỉ log câu lệnh mẫu 1 lần
          if (copiedCount === 1) {
            console.log(
              "[DEBUG CopyCriteria] Option insert query template:",
              optQuery
            );
          }

          // Lặp qua từng option cũ để insert option mới
          for (const oldOpt of oldCrit.options) {
            // Tạo mảng tham số cho option
            const optParams = [
              newCriterionId, // ID của tiêu chí mới
              oldOpt.label,
              // Lấy điểm từ tên cột đúng (OPT_SCORE_COL), fallback về 'score', mặc định là 0
              oldOpt[OPT_SCORE_COL] ?? oldOpt.score ?? 0,
            ];
            // Thêm tham số thứ tự nếu cần
            if (OPT_ORDER_COL) {
              // Lấy thứ tự từ tên cột đúng (OPT_ORDER_COL), fallback về 'display_order', mặc định là 99
              optParams.push(
                oldOpt[OPT_ORDER_COL] ?? oldOpt.display_order ?? 99
              );
            }
            // Thực thi INSERT option
            await client.query(optQuery, optParams);
          }
          console.log(
            `[DEBUG CopyCriteria] Finished inserting options for criterion ID ${newCriterionId}.`
          );
        } else {
          console.log(
            `[DEBUG CopyCriteria] No options to insert for criterion ID ${oldCrit.id}.`
          );
        }
      } catch (critInsertErr) {
        // Nếu có lỗi khi INSERT tiêu chí hoặc options
        console.error(
          `---> ERROR inserting criterion ID ${oldCrit.id} (Code: ${oldCrit.code}) or its options:`,
          critInsertErr
        );
        // Ném lỗi ra ngoài để rollback transaction chính
        throw critInsertErr;
      }
    } // Kết thúc vòng lặp for (lặp qua từng tiêu chí nguồn)

    console.log("[DEBUG CopyCriteria] Committing main transaction.");
    await client.query("COMMIT"); // Lưu tất cả thay đổi vào CSDL

    // Tạo thông báo kết quả
    let message = `Đã sao chép ${copiedCount} tiêu chí từ kỳ ${sourceTermCode} sang ${targetTermCode}.`;
    if (skippedCount > 0) {
      // Thêm thông tin nếu có tiêu chí bị bỏ qua
      message += ` Đã bỏ qua ${skippedCount} tiêu chí do không thể xử lý nhóm.`;
    }
    // Trả về kết quả thành công
    res.json({ ok: true, copiedCount, skippedCount, message });
  } catch (err) {
    // Nếu có bất kỳ lỗi nào trong transaction chính
    console.error(
      "[DEBUG CopyCriteria] Rolling back main transaction due to error:",
      err
    );
    await client.query("ROLLBACK"); // Hoàn tác tất cả thay đổi
    console.error("Admin Copy Criteria Error:", err);
    // Ghi log thêm thông tin lỗi CSDL nếu có
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
  } finally {
    // Luôn thực hiện dù thành công hay thất bại
    console.log("[DEBUG CopyCriteria] Releasing client.");
    client.release(); // Trả kết nối về pool
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
    console.error("Lỗi ở searchClass",error);
    res.status(500).json({ error: "Lỗi hệ thống", detail: error.message });
  }
};

// --- HẾT THAY THẾ ---
