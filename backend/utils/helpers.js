import pool from '../db.js';

/**
  @param {function} callback - Hàm nhận vào client, thực hiện các thao tác DB
  @returns {Promise<any>} 
 */
export const withTransaction = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

// Biến cục bộ để lưu kết quả probe (sẽ được set ở server.js)
let config = {
  HAS_GROUP_ID: false,
  GROUP_ID_REQUIRED: false, 
  OPT_SCORE_COL: 'score',
  GROUP_TBL: 'drl.criteria_group'
};

// Hàm để cập nhật config từ server.js
export const setDbConfig = (dbConfig) => {
  config = { ...config, ...dbConfig };
};

export const toNum = (v) => (v == null ? null : Number(v));

//Parse số nhóm từ mã tiêu chí (ví dụ: "1.1" -> 1, "2A" -> 2)
export const parseGroupId = (code) => {
  if (!code) return null;
  const groupNumber = String(code).split(".")[0].replace(/\D/g, "");
  return groupNumber ? Number(groupNumber) : null;
};

export const getConfig = () => config;
