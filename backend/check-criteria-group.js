import pool from './db.js';

async function checkCriteriaGroupStructure() {
  try {
    console.log('=== TABLE STRUCTURE: drl.criteria_group ===\n');
    
    const cols = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'drl' AND table_name = 'criteria_group'
      ORDER BY ordinal_position
    `);
    console.table(cols.rows);
    
    console.log('\n=== SAMPLE DATA: drl.criteria_group ===\n');
    const data = await pool.query('SELECT * FROM drl.criteria_group LIMIT 5');
    console.table(data.rows);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

checkCriteriaGroupStructure();
