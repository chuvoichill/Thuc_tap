import pool from "../../db.js";
import { getConfig, toNum, parseGroupId, validateGroupIdMaybe } from "../../utils/helpers.js";

// ============================================
// CRITERION - Basic Queries
// ============================================

// Lấy thông tin tiêu chí theo ID
export const getCriterionById = async (id) => {
  const query = `SELECT * FROM drl.criterion WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

// Lấy thông tin tiêu chí theo ID kèm term_code (dùng cho update)
export const getCriterionWithTerm = async (id) => {
  const query = `SELECT term_code FROM drl.criterion WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0] || null;
};

// Lấy loại tiêu chí (type)
export const getCriterionType = async (id) => {
  const query = `SELECT type FROM drl.criterion WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0]?.type || null;
};

// Lấy điểm tối đa của tiêu chí (max_points)
export const getCriterionMaxPoints = async (id) => {
  const query = `SELECT max_points FROM drl.criterion WHERE id = $1`;
  const { rows } = await pool.query(query, [id]);
  return rows[0]?.max_points || 0;
};

// ============================================
// GROUP - Find or Create
// ============================================

// Tìm hoặc tạo nhóm tiêu chí (hỗ trợ transaction)
export const findOrCreateGroup = async (term_code, groupCode, client = null) => {
  const { GROUP_TBL } = getConfig();
  const db = client || pool;
  
  if (!groupCode || !term_code) return null;

  try {
    // 1. Thử tìm nhóm đã tồn tại theo term_code và code
    const selectQuery = `SELECT id FROM ${GROUP_TBL} WHERE term_code = $1 AND code = $2`;
    const selectResult = await db.query(selectQuery, [term_code, groupCode]);
    
    if (selectResult.rowCount > 0) {
      return selectResult.rows[0].id;
    }

    // 2. Nếu không tồn tại, tạo mới
    const insertQuery = `
      INSERT INTO ${GROUP_TBL} (term_code, code, title)
      VALUES ($1, $2, $3)
      ON CONFLICT (term_code, code) DO NOTHING
      RETURNING id
    `;
    const insertResult = await db.query(insertQuery, [
      term_code,
      groupCode,
      `Nhóm ${groupCode}`
    ]);

    if (insertResult.rowCount > 0) {
      return insertResult.rows[0].id;
    }

    // 3. Nếu INSERT bị CONFLICT, select lại (race condition)
    const refetchResult = await db.query(selectQuery, [term_code, groupCode]);
    return refetchResult.rows[0]?.id || null;

  } catch (error) {
    console.error("[findOrCreateGroup] Error:", error.message);
    return null;
  }
};

// ============================================
// CRITERION - Create/Update
// ============================================

// Upsert tiêu chí (INSERT hoặc UPDATE nếu đã tồn tại)
export const upsertCriterion = async (criterionData) => {
  const {
    term_code,
    code,
    title,
    type,
    max_points,
    display_order,
    group_id
  } = criterionData;

  const { HAS_GROUP_ID } = getConfig();

  const query = `
    INSERT INTO drl.criterion(term_code, code, title, type, max_points, display_order, group_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (term_code, code)
    DO UPDATE SET
      title = EXCLUDED.title,
      type = EXCLUDED.type,
      max_points = EXCLUDED.max_points,
      display_order = EXCLUDED.display_order,
      group_id = EXCLUDED.group_id
    RETURNING *
  `;

  const params = [
    term_code,
    code,
    title,
    type,
    toNum(max_points) || 0,
    toNum(display_order) ?? 999,
    HAS_GROUP_ID ? group_id : null
  ];

  const { rows } = await pool.query(query, params);
  return rows[0];
};

// Cập nhật tiêu chí theo ID
export const updateCriterionById = async (id, criterionData) => {
  const {
    code,
    title,
    type,
    max_points,
    display_order,
    require_hsv_verify,
    group_id
  } = criterionData;

  const { HAS_GROUP_ID } = getConfig();

  const params = [
    code,
    title,
    type,
    toNum(max_points) || 0,
    toNum(display_order) ?? 999,
    require_hsv_verify
  ];

  let setClauses = "code=$1, title=$2, type=$3, max_points=$4, display_order=$5, require_hsv_verify=$6";

  // Chỉ cập nhật group_id nếu cột tồn tại
  if (HAS_GROUP_ID) {
    setClauses += `, group_id=$${params.length + 1}`;
    params.push(group_id);
  }

  params.push(id); // id cho WHERE clause

  const query = `UPDATE drl.criterion SET ${setClauses} WHERE id = $${params.length} RETURNING *`;
  const { rows } = await pool.query(query, params);
  
  return rows[0] || null;
};

// ============================================
// CRITERION - Delete with Cascade
// ============================================

// Xóa tiêu chí cùng với các bản ghi phụ thuộc (transaction)
export const deleteCriterionCascade = async (id) => {
  const client = await pool.connect();
  
  try {
    await client.query("BEGIN");

    // Xóa các bảng phụ thuộc trước
    await client.query(`DELETE FROM drl.self_assessment WHERE criterion_id = $1`, [id]);
    await client.query(`DELETE FROM drl.criterion_option WHERE criterion_id = $1`, [id]);
    
    // Thử xóa bảng evidence_map (có thể không tồn tại)
    try {
      await client.query(`DELETE FROM drl.criterion_evidence_map WHERE criterion_id = $1`, [id]);
    } catch (_) {
      // Bỏ qua nếu bảng không tồn tại
    }

    // Xóa tiêu chí chính
    const result = await client.query(`DELETE FROM drl.criterion WHERE id = $1 RETURNING id`, [id]);

    if (result.rowCount === 0) {
      throw new Error("criterion_not_found");
    }

    await client.query("COMMIT");
    return result.rows[0];

  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// ============================================
// CRITERION OPTIONS - Management
// ============================================

// Xóa liên kết option_id trong self_assessment
export const nullifyAssessmentOptions = async (criterion_id, client = null) => {
  const db = client || pool;
  const query = `
    UPDATE drl.self_assessment 
    SET option_id = NULL
    WHERE criterion_id = $1 AND option_id IS NOT NULL
  `;
  await db.query(query, [criterion_id]);
};

// Thay thế toàn bộ options của tiêu chí (transaction)
export const replaceCriterionOptions = async (criterion_id, options, client = null) => {
  const { OPT_SCORE_COL, OPT_ORDER_COL } = getConfig();
  const db = client || pool;

  // 1. Bỏ liên kết option_id trong self_assessment
  await nullifyAssessmentOptions(criterion_id, db);

  // 2. Xóa tất cả option cũ
  await db.query(`DELETE FROM drl.criterion_option WHERE criterion_id = $1`, [criterion_id]);

  // 3. Insert các option mới
  const insertedOptions = [];
  
  if (options.length > 0) {
    const cols = ["criterion_id", "label", OPT_SCORE_COL];
    const valuePlaceholders = ["$1", "$2", "$3"];
    
    if (OPT_ORDER_COL) {
      cols.push(OPT_ORDER_COL);
      valuePlaceholders.push("$4");
    }

    const queryText = `
      INSERT INTO drl.criterion_option (${cols.join(", ")}) 
      VALUES (${valuePlaceholders.join(", ")}) 
      RETURNING *
    `;

    for (let i = 0; i < options.length; i++) {
      const opt = options[i];
      const label = (opt.label || "").trim();
      
      if (!label) continue; // Bỏ qua option không có label

      const params = [criterion_id, label, toNum(opt.score) || 0];
      
      if (OPT_ORDER_COL) {
        params.push(toNum(opt.display_order) ?? i + 1);
      }

      const result = await db.query(queryText, params);
      insertedOptions.push(result.rows[0]);
    }
  }

  return insertedOptions;
};



