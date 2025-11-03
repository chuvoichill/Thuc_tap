import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://postgres:123@localhost:5432/md',
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

export default pool;