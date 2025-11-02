const { Pool } = require('pg');
require('dotenv').config(); // Đảm bảo đọc được biến môi trường

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:123456@localhost:5432/danhGiaDRL',
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
});

// Kiểm tra kết nối ban đầu (tùy chọn)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Không kết nối được với DB:', err.stack);
  } else {
    console.log('Kết nối thành công với DB', res.rows[0].now);
  }
});

module.exports = pool; // Export pool để dùng ở nơi khác