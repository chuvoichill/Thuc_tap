import pool from "../../db.js";
import { getConfig, toNum, parseGroupId, withTransaction } from "../../utils/helpers.js";

// Error codes
export const CRITERION_ERRORS = {
  NOT_FOUND: "Không tìm thấy tiêu chí!",
  NOT_RADIO: "Tiêu chí không phải là radio!",
  NO_OPTIONS: "Tiêu chí radio yêu cầu có các tùy chọn",
  NEGATIVE_SCORE: "Điểm của tùy chọn không được âm",
  SCORE_EXCEEDS_MAX: "Điểm của tùy chọn vượt quá điểm tối đa",
  CANNOT_DETERMINE_GROUP: "Không thể xác định hoặc tạo nhóm",
  CANNOT_CHANGE_HSV_VERIFY: "Không thể thay đổi yêu cầu xác nhận HSV vì đã có sinh viên đánh giá.",
  INVALID_ID: "mã tiêu chí không hợp lệ"
};

/**
 * Base query builder - DRY for all criterion queries
 */
const queryCriterion = async (id, fields = '*') => {
  if (!id || !Number.isInteger(Number(id)) || Number(id) < 1) {
    throw new Error(CRITERION_ERRORS.INVALID_ID);
  }
  const { rows } = await pool.query(
    `SELECT ${fields} FROM drl.criterion WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// QUERY FUNCTIONS 

export const getCriterionById = (id) => queryCriterion(id);
export const getCriterionForUpdate = (id) => queryCriterion(id, 'term_code, require_hsv_verify');
export const getCriterionForValidation = (id) => queryCriterion(id, 'type, max_points');

// ============================================
// VALIDATION FUNCTIONS (Exported for reusability)
// ============================================

// Kiểm tra tiêu chí đã có sinh viên đánh giá chưa
export const checkCriterionAssessments = async (criterion_id) => {
  const { rows } = await pool.query(
    `SELECT COUNT(*) as count FROM drl.self_assessment WHERE criterion_id = $1`,
    [criterion_id]
  );
  return parseInt(rows[0]?.count) || 0;
};

/**
 * Validate options - throws on invalid
 */
export const validateCriterionOptions = (options, max_points) => {
  if (!Array.isArray(options) || options.length === 0) {
    throw new Error(CRITERION_ERRORS.NO_OPTIONS);
  }

  for (const opt of options) {
    const label = (opt.label || "").trim();
    if (!label) continue;
    
    const score = toNum(opt.score);
    if (score < 0) {
      throw new Error(CRITERION_ERRORS.NEGATIVE_SCORE);
    }
    if (max_points > 0 && score > max_points) {
      throw new Error(CRITERION_ERRORS.SCORE_EXCEEDS_MAX);
    }
  }
};


// Giải quyết group_id từ groupCode (ID hoặc code) hoặc tự động tạo
const resolveGroupId = async (groupCode, criterionData) => {
  const { HAS_GROUP_ID, GROUP_TBL } = getConfig();
  if (!HAS_GROUP_ID) return null;

  // Trường hợp 1: groupCode là số (ID) → Validate tồn tại
  if (groupCode && !isNaN(Number(groupCode))) {
    try {
      const { rows } = await pool.query(
        `SELECT id FROM ${GROUP_TBL} WHERE id = $1`,
        [Number(groupCode)]
      );
      if (rows.length > 0) return rows[0].id;
      // ID không tồn tại → tiếp tục các trường hợp khác
      console.warn(`[resolveGroupId] Group ID ${groupCode} not found, trying other strategies`);
    } catch (error) {
      console.error('[resolveGroupId] Validate ID error:', error.message);
    }
  }
  
  // Trường hợp 2: groupCode là string (code) → Tìm hoặc tạo theo code
  if (groupCode && typeof groupCode === 'string' && criterionData.term_code) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${GROUP_TBL} (term_code, code, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (term_code, code) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        [criterionData.term_code, groupCode, `Nhóm ${groupCode}`]
      );
      if (rows[0]) return rows[0].id;
    } catch (error) {
      console.error('[resolveGroupId] Create/find by code error:', error.message);
    }
  }

  // Trường hợp 3: Không có groupCode → Parse từ mã tiêu chí
  const groupNumber = parseGroupId(criterionData.code);
  if (groupNumber && criterionData.term_code) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO ${GROUP_TBL} (term_code, code, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (term_code, code) DO UPDATE SET code = EXCLUDED.code
         RETURNING id`,
        [criterionData.term_code, String(groupNumber), `Nhóm ${groupNumber}`]
      );
      if (rows[0]) return rows[0].id;
    } catch (error) {
      console.error('[resolveGroupId] Auto-create from criterion code error:', error.message);
    }
  }

  // Không tìm/tạo được → return null (controller sẽ throw error nếu required)
  console.warn('[resolveGroupId] Cannot determine group_id for criterion:', criterionData.code);
  return null;
};

/**
 * [INTERNAL] Insert options - simple loop (readable, maintainable)
 */
const insertCriterionOptions = async (criterion_id, options, client = null) => {
  const db = client || pool;

  if (!options || options.length === 0) return [];

  const validOptions = options
    .map((opt, i) => ({
      label: (opt.label || "").trim(),
      score: toNum(opt.score) || 0
    }))
    .filter(opt => opt.label);

  if (validOptions.length === 0) return [];

  const insertedOptions = [];
  const cols = ["criterion_id", "label", "score"];
  const queryText = `
    INSERT INTO drl.criterion_option (${cols.join(", ")}) 
    VALUES ($1, $2, $3) 
    RETURNING *
  `;

  for (const opt of validOptions) {
    const { rows } = await db.query(queryText, [
      criterion_id,
      opt.label,
      opt.score
    ]);
    insertedOptions.push(rows[0]);
  }

  return insertedOptions;
};

// ============================================
// PUBLIC API
// ============================================


// Xóa tiêu chí với cascade
export const deleteCriterionCascade = async (id) => {
  return withTransaction(async (client) => {
    await client.query(`DELETE FROM drl.self_assessment WHERE criterion_id = $1`, [id]);
    await client.query(`DELETE FROM drl.criterion_option WHERE criterion_id = $1`, [id]);
    const { rows } = await client.query(`DELETE FROM drl.criterion WHERE id = $1 RETURNING id`, [id]);
    if (rows.length === 0) throw new Error(CRITERION_ERRORS.NOT_FOUND);
    return rows[0];
  });
};

//Tạo mới tiêu chí với group handling
export const createCriterion = async (criterionData, groupCode) => {
  const { HAS_GROUP_ID, GROUP_ID_REQUIRED } = getConfig();
  
  const group_id = await resolveGroupId(groupCode, criterionData);
  if (GROUP_ID_REQUIRED && !group_id) {
    throw new Error(CRITERION_ERRORS.CANNOT_DETERMINE_GROUP);
  }

  const { rows } = await pool.query(
    `INSERT INTO drl.criterion(term_code, code, title, type, max_points, group_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      criterionData.term_code,
      criterionData.code,
      criterionData.title,
      criterionData.type,
      toNum(criterionData.max_points) || 0,
      HAS_GROUP_ID ? group_id : null
    ]
  );
  return rows[0];
};

//Cập nhật tiêu chí
export const updateCriterion = async (id, criterionData, groupCode = null) => {
  const { HAS_GROUP_ID, GROUP_ID_REQUIRED } = getConfig();
  
  const existing = await getCriterionForUpdate(id);
  if (!existing) throw new Error(CRITERION_ERRORS.NOT_FOUND);

  if (criterionData.require_hsv_verify !== undefined && 
      existing.require_hsv_verify !== criterionData.require_hsv_verify) {
    
    const assessmentCount = await checkCriterionAssessments(id);
    
    if (assessmentCount > 0) {
      const action = criterionData.require_hsv_verify ? 'thêm' : 'bỏ';
      const error = new Error(`Không thể ${action} yêu cầu HSV xác nhận vì đã có ${assessmentCount} sinh viên đánh giá.`);
      error.code = CRITERION_ERRORS.CANNOT_CHANGE_HSV_VERIFY;
      error.assessmentCount = assessmentCount;
      throw error;
    }
  }

  let group_id = criterionData.group_id;
  if (groupCode) {
    group_id = await resolveGroupId(groupCode, {
      term_code: criterionData.term_code || existing.term_code,
      code: criterionData.code
    });
    if (GROUP_ID_REQUIRED && !group_id) {
      throw new Error(CRITERION_ERRORS.CANNOT_DETERMINE_GROUP);
    }
  }

  const params = [
    criterionData.code,
    criterionData.title,
    criterionData.type,
    toNum(criterionData.max_points) || 0,
    criterionData.require_hsv_verify
  ];
  let setClauses = "code=$1, title=$2, type=$3, max_points=$4, require_hsv_verify=$5";

  if (HAS_GROUP_ID) {
    setClauses += `, group_id=$${params.length + 1}`;
    params.push(group_id);
  }
  params.push(id);

  const { rows } = await pool.query(
    `UPDATE drl.criterion SET ${setClauses} WHERE id = $${params.length} RETURNING *`,
    params
  );
  return rows[0] || null;
};

//Cập nhật options của tiêu chí
export const updateCriterionOptions = async (criterion_id, options) => {
  return withTransaction(async (client) => {
    const criterion = await getCriterionForValidation(criterion_id);
    if (!criterion) throw new Error(CRITERION_ERRORS.NOT_FOUND);
    if (criterion.type !== "radio") throw new Error(CRITERION_ERRORS.NOT_RADIO);

    validateCriterionOptions(options, criterion.max_points);

    await client.query(
      `UPDATE drl.self_assessment SET option_id = NULL WHERE criterion_id = $1 AND option_id IS NOT NULL`,
      [criterion_id]
    );
    await client.query(`DELETE FROM drl.criterion_option WHERE criterion_id = $1`, [criterion_id]);
    
    const insertedOptions = await insertCriterionOptions(criterion_id, options, client);

    return { ok: true, options: insertedOptions };
  });
};

//Kiểm tra dữ liệu
export const checkdeleteAllCriteria = async (term_code) => {
  const result = await pool.query(`select 1 from  drl.self_assessment where term_code = $1 limit 1`,[term_code]);
  return result.rowCount > 0;
};
//Xóa tất cả tiêu chí
export const deleteAllCriteria = async (term_code) => {
  //Xóa lựa chọn 
  await pool.query(`delete from drl.criterion_option where criterion_id in (select id from drl.criterion where term_code = $1)`,[term_code]);

  //Xóa tiêu chí
  await pool.query(`delete from drl.criterion where term_code = $1`,[term_code]);
  return true;  
};
//Kiểm tra dữ liệu
export const checkCopyCriteria = async (targetTermCode) => {
   //Kiểm tra kì đích đã có dữ liệu chưa
  const target_TermCode= await pool.query(`select 1 from drl.criteria_group where term_code = $1`,[targetTermCode]);
  if (target_TermCode.rowCount != 0)  throw { status: 400, message: "Kì đích đã có dữ liệu nên không thể sao chép" };

  return true;
};
// Sao chep tieu chi
export const copyCriteria = async (sourceTermCode, targetTermCode) => {
  //Sao chép criteria_Group
  await pool.query(`insert into drl.criteria_group (term_code, code, title)
    select $1, code, title
    from drl.criteria_group where term_code=$2`,[targetTermCode, sourceTermCode]);

  // Sao chép criterion
  const targetGroups = await pool.query(`select id, title from drl.criteria_group where term_code = $1`,[targetTermCode]);
  
  for (let i = 0;i < targetGroups.rows.length;i++) {
    const group = targetGroups.rows[i];
    const sourceGroup = await pool.query(`select id from drl.criteria_group where term_code = $1 AND title = $2`,[sourceTermCode, group.title]);

    await pool.query(`insert into drl.criterion (term_code, group_id, code, title, type, max_points, require_hsv_verify)
      select $1, $2, code, title, type, max_points, require_hsv_verify
      from drl.criterion where group_id = $3`,[targetTermCode, group.id, sourceGroup.rows[0].id]); 
  };

  // Sao chép criterion_option  
  const targetCriteria = await pool.query(`select id, title from drl.criterion where term_code = $1`,[targetTermCode] );

  for (let i = 0;i< targetCriteria.rows.length;i++) {
    const criterion = targetCriteria.rows[i];
    const sourceCri = await pool.query(`select id from drl.criterion where term_code = $1 and title = $2`,[sourceTermCode, criterion.title]);

    await pool.query(`insert into drl.criterion_option (criterion_id, label, score)
      select $1, label, score
      from drl.criterion_option
      where criterion_id = $2`,[criterion.id, sourceCri.rows[0].id]);
  }
  return true;
};
