import pool from '../db.js';

// Biến cục bộ để lưu kết quả probe (sẽ được set ở server.js)
let config = {
  HAS_GROUP_ID: false,
  GROUP_ID_NOT_NULL: false,
  OPT_SCORE_COL: 'score',
  OPT_ORDER_COL: 'display_order',
  GROUP_TBL: 'drl.criteria_group'
};

// Hàm để cập nhật config từ server.js
export const setDbConfig = (dbConfig) => {
  config = { ...config, ...dbConfig };
  // console.log('[Helpers] DB Config updated:', config); // Log để kiểm tra
};


export const toNum = (v) => (v == null ? null : Number(v));

export const parseGroupId = (code) => {
  if (!code) return null;
  const g = String(code).split(".")[0].replace(/\D/g, "");
  return g ? Number(g) : null;
};

// Trả về group_id hợp lệ nếu có; nếu không có trả null
export const validateGroupIdMaybe = async (group_id) => {
  if (!config.HAS_GROUP_ID || group_id == null) return null; // Sử dụng config
  try {
    const r = await pool.query(`SELECT id FROM ${config.GROUP_TBL} WHERE id = $1`, [Number(group_id)]);
    return r.rowCount ? Number(group_id) : null;
  } catch (_) {
    return null;
  }
};

// Tìm (hoặc tự tạo) group_id fallback để thỏa mãn NOT NULL + FK
export const pickFallbackGroupId = async ({ term_code, code }) => {
  if (!config.HAS_GROUP_ID) return null; // Sử dụng config

  const want = parseGroupId(code);

  // 1) cùng "số nhóm" (từ code/title)
  if (want != null) {
    try {
      const r1 = await pool.query(
        `SELECT id FROM ${config.GROUP_TBL}
         WHERE cast(NULLIF(regexp_replace(COALESCE(code::text,title::text,''),'\\D','','g'),'') as int) = $1
         ORDER BY id LIMIT 1`,
        [want]
      );
      if (r1.rowCount) return r1.rows[0].id;
    } catch (_) {}
  }

  // 2) cùng term_code
  if (term_code) {
    try {
      const r2 = await pool.query(
        `SELECT id FROM ${config.GROUP_TBL} WHERE term_code = $1 ORDER BY id LIMIT 1`,
        [term_code]
      );
      if (r2.rowCount) return r2.rows[0].id;
    } catch (_) {}
  }

  // 3) bất kỳ nhóm có sẵn
  try {
    const r3 = await pool.query(`SELECT id FROM ${config.GROUP_TBL} ORDER BY id LIMIT 1`);
    if (r3.rowCount) return r3.rows[0].id;
  } catch (_) {}

  // 4) TỰ TẠO nhóm nếu có term_code và xác định được số nhóm từ mã tiêu chí
  if (term_code && want != null) {
    try {
      const r4 = await pool.query(
        `INSERT INTO ${config.GROUP_TBL}(term_code, code, title)
         VALUES ($1, $2, $3)
         ON CONFLICT (term_code, code) DO NOTHING -- Tránh lỗi nếu nhóm đã tồn tại
         RETURNING id`,
        [term_code, String(want), `Nhóm ${want}`]
      );
      if (r4.rowCount) return r4.rows[0].id;
      // Nếu không insert được (do CONFLICT), thử select lại
      const r5 = await pool.query(`SELECT id FROM ${config.GROUP_TBL} WHERE term_code = $1 AND code = $2`, [term_code, String(want)]);
      if (r5.rowCount) return r5.rows[0].id;

    } catch (e) {
      console.warn("[AUTO-GROUP] create/select failed:", e.message);
    }
  }

  return null;
};

export const getConfig = () => config;
