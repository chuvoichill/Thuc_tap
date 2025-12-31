import pool from "../../db.js";
import { toNum, withTransaction } from "../../utils/helpers.js";

const queryCriterion = async (id, fields = '*') => {
  const { rows } = await pool.query(
    `SELECT ${fields} FROM drl.criterion WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
};


// Tạo mới tiêu chí (nhận group_id trực tiếp)
export const createCriterion = async (term_code, code, title, type, max_points, group_id, requires_evidence = false) => {
  const { rows } = await pool.query(
    `INSERT INTO drl.criterion(term_code, code, title, type, max_points, group_id, requires_evidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [term_code, code, title, type, max_points || 0, group_id, requires_evidence]
  );
  return rows[0];
};

// Cập nhật tiêu chí (nhận group_id trực tiếp)
export const updateCriterion = async (id, term_code, code, title, type, max_points, group_id, requires_evidence = false) => {
  const existing = await queryCriterion(id, 'term_code');
  if (!existing) throw new Error("Không tìm thấy tiêu chí");

  const { rows } = await pool.query(
    `UPDATE drl.criterion 
     SET code=$1, title=$2, type=$3, max_points=$4, group_id=$5, requires_evidence=$6 
     WHERE id = $7 
     RETURNING *`,
    [code, title, type, max_points || 0, group_id, requires_evidence, id]
  );
  return rows[0] || null;
};

// Xóa tiêu chí 
export const deleteCriterion = async (id) => {
  const { rows } = await pool.query(
    `DELETE FROM drl.criterion WHERE id = $1 RETURNING id`,
    [id]
  );
  if (rows.length === 0) throw new Error("Không tìm thấy tiêu chí");
  return rows[0];
};

//Cập nhật options của tiêu chí
export const updateCriterionOptions = async (criterion_id, options) => {
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
  return withTransaction(async (client) => {
     //Sao chép criteria_Group
      await client.query(`insert into drl.criteria_group (term_code, code, title)
        select $1, code, title
        from drl.criteria_group where term_code=$2`,[targetTermCode, sourceTermCode]);

      // Sao chép criterion
      const targetGroups = await client.query(`select id, title from drl.criteria_group where term_code = $1`,[targetTermCode]);
      
      for (let i = 0;i < targetGroups.rows.length;i++) {
        const group = targetGroups.rows[i];
        const sourceGroup = await client.query(`select id from drl.criteria_group where term_code = $1 AND title = $2`,[sourceTermCode, group.title]);
        await client.query(`insert into drl.criterion (term_code, group_id, code, title, type, max_points, requires_evidence)
          select $1, $2, code, title, type, max_points, requires_evidence
          from drl.criterion where group_id = $3`,[targetTermCode, group.id, sourceGroup.rows[0].id]); 
      };

      // Sao chép criterion_option  
      const targetCriteria = await client.query(`select id, title from drl.criterion where term_code = $1`,[targetTermCode] );

      for (let i = 0;i< targetCriteria.rows.length;i++) {
        const criterion = targetCriteria.rows[i];
        const sourceCri = await client.query(`select id from drl.criterion where term_code = $1 and title = $2`,[sourceTermCode, criterion.title]);
        await client.query(`insert into drl.criterion_option (criterion_id, label, score)
          select $1, label, score
          from drl.criterion_option
          where criterion_id = $2`,[criterion.id, sourceCri.rows[0].id]);
      }
      return true;
  });
};
