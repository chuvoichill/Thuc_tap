import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const { Pool } = pg;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
  idleTimeoutMillis: 30000,
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Không kết nối được với DB:', err.stack);
  } else {
    console.log('Kết nối thành công với DB', res.rows[0].now);
  }
});

export default pool;