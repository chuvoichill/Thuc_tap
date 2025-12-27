import pool from '../db.js';

async function addLeaderApprovedColumn() {
  try {
    await pool.query(`
      ALTER TABLE drl.class_term_status
      ADD COLUMN IF NOT EXISTS is_leader_approved BOOLEAN DEFAULT FALSE;
    `);
    console.log('Added is_leader_approved column successfully');
  } catch (error) {
    console.error('Error adding column:', error);
  } finally {
    pool.end();
  }
}

addLeaderApprovedColumn();