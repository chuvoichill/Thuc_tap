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

export const toNum = (v) => (v == null ? null : Number(v));

