import pool from './db.js';

async function checkConstraints() {
  try {
    console.log('=== Constraints trên drl.self_assessment ===');
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_schema = 'drl' AND table_name = 'self_assessment'
    `);
    
    constraints.rows.forEach(c => {
      console.log(`  ${c.constraint_name}: ${c.constraint_type}`);
    });
    
    console.log('\n=== Chi tiết UNIQUE constraints ===');
    const uniqueConstraints = await pool.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'drl'
        AND tc.table_name = 'self_assessment'
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `);
    
    if (uniqueConstraints.rows.length > 0) {
      let currentConstraint = '';
      uniqueConstraints.rows.forEach(row => {
        if (row.constraint_name !== currentConstraint) {
          currentConstraint = row.constraint_name;
          console.log(`\n  ${row.constraint_name}:`);
        }
        console.log(`    - ${row.column_name}`);
      });
    } else {
      console.log('  Không có UNIQUE constraint');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Lỗi:', error.message);
    process.exit(1);
  }
}

checkConstraints();
