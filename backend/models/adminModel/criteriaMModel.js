import pool from "../../db.js";
import { toNum, withTransaction } from "../../utils/helpers.js";

const queryCriterion = async (id, fields = '*') => {
  const { rows } = await pool.query(
    `SELECT ${fields} FROM drl.criterion WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};

// Tìm hoặc tạo group_id từ groupCode
const resolveGroupId = async (groupCode, criterionData) => {
  if (!groupCode || !criterionData.term_code) return null;

  // Nếu groupCode là số (ID) → Validate tồn tại
  if (!isNaN(Number(groupCode))) {
    const { rows } = await pool.query(
      `SELECT id FROM drl.criteria_group WHERE id = $1`,
      [Number(groupCode)]
    );
    if (rows.length > 0) return rows[0].id;
  }
  
  // Nếu groupCode là string (code) → Tìm hoặc tạo
  const { rows } = await pool.query(
    `INSERT INTO drl.criteria_group (term_code, code, title)
     VALUES ($1, $2, $3)
     ON CONFLICT (term_code, code) DO UPDATE SET code = EXCLUDED.code
     RETURNING id`,
    [criterionData.term_code, String(groupCode), `Nhóm ${groupCode}`]
  );
  return rows[0]?.id || null;
};


// Xóa tiêu chí (database tự động cascade)
export const deleteCriterion = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM drl.criterion WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) throw new Error("Không tìm thấy tiêu chí");
  return rows[0];
};

// Tạo mới tiêu chí
// models/adminModel/criteriaMModel.js
export const createCriterion = async (term_code, code, title, type, max_points, group_code) => {
  const group_id = await resolveGroupId(group_code, { term_code });
  
  const { rows } = await pool.query(
    `INSERT INTO drl.criterion(term_code, code, title, type, max_points, group_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [term_code, code, title, type, max_points || 0, group_id]
  );
  
  return rows[0];
};

// Cập nhật tiêu chí
export const updateCriterion = async (id, term_code, code, title, type, max_points, require_hsv_verify, group_code) => {
  const existing = await queryCriterion(id, 'term_code, require_hsv_verify');
  if (!existing) throw new Error("Không tìm thấy tiêu chí");

  if (require_hsv_verify !== undefined && existing.require_hsv_verify !== require_hsv_verify) {
    const { rows } = await pool.query(
      `SELECT EXISTS(SELECT 1 FROM drl.self_assessment WHERE criterion_id = $1)`,
      [id]
    );
    if (rows[0].exists) {
      throw new Error("Không thể thay đổi yêu cầu xác nhận HSV vì đã có sinh viên đánh giá");
    }
  }

  const group_id = await resolveGroupId(group_code, { term_code: term_code || existing.term_code });

  const { rows } = await pool.query(
    `UPDATE drl.criterion 
     SET code=$1, title=$2, type=$3, max_points=$4, require_hsv_verify=$5, group_id=$6 
     WHERE id = $7 
     RETURNING *`,
    [code, title, type, max_points || 0, require_hsv_verify, group_id, id]
  );
  return rows[0] || null;
};

//Cập nhật options của tiêu chí
export const updateCriterionOptions = async (criterion_id, options) => {
  return withTransaction(async (client) => {
    const criterion = await queryCriterion(criterion_id, 'type');
    if (!criterion) throw new Error("Không tìm thấy tiêu chí");
    if (criterion.type !== "radio") throw new Error("Tiêu chí không phải là radio");

    await client.query(
      `UPDATE drl.self_assessment SET option_id = NULL 
       WHERE criterion_id = $1 AND option_id IS NOT NULL`,
      [criterion_id]
    );
    await client.query(
      `DELETE FROM drl.criterion_option WHERE criterion_id = $1`, 
      [criterion_id]
    );
    
    // Insert new options
    if (!options || options.length === 0) return { ok: true, options: [] };
    
    const validOptions = options
      .map(opt => ({
        label: (opt.label || "").trim(),
        score: toNum(opt.score) || 0
      }))
      .filter(opt => opt.label);

    if (validOptions.length === 0) return { ok: true, options: [] };

    const values = validOptions.map((_, i) => 
      `($1, $${i*2+2}, $${i*2+3})`
    ).join(', ');
    
    const params = [
      criterion_id,
      ...validOptions.flatMap(opt => [opt.label, opt.score])
    ];

    const { rows } = await client.query(
      `INSERT INTO drl.criterion_option (criterion_id, label, score) 
       VALUES ${values} RETURNING *`,
      params
    );

    return { ok: true, options: rows };
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
