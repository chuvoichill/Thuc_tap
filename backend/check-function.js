import pool from './db.js';

async function checkFunction() {
  try {
    // Kiểm tra function rank_by_score
    console.log('=== Kiểm tra function drl.rank_by_score ===');
    const functions = await pool.query(`
      SELECT routine_name, routine_type
      FROM information_schema.routines
      WHERE routine_schema = 'drl'
        AND routine_name LIKE '%rank%'
    `);
    
    console.log(`Found ${functions.rows.length} functions:`);
    functions.rows.forEach(f => {
      console.log(`  ${f.routine_name} (${f.routine_type})`);
    });
    
    if (functions.rows.length === 0) {
      console.log('\n⚠️  Không tìm thấy function rank_by_score!');
      console.log('Cần tạo function hoặc bỏ phần rank trong query');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Lỗi:', error.message);
    process.exit(1);
  }
}

checkFunction();
