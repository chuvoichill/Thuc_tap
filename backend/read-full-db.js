import pool from './db.js';

async function readFullDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('========================================');
    console.log('   FULL DATABASE STRUCTURE REPORT');
    console.log('========================================\n');
    
    // 1. SCHEMAS
    console.log('=== SCHEMAS ===');
    const schemas = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name
    `);
    schemas.rows.forEach(row => console.log(`  - ${row.schema_name}`));

    // 2. AUTH SCHEMA
    console.log('\n=== AUTH SCHEMA TABLES ===');
    const authTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'auth' 
      ORDER BY table_name
    `);
    authTables.rows.forEach(row => console.log(`  - auth.${row.table_name}`));

    // 3. REF SCHEMA
    console.log('\n=== REF SCHEMA TABLES ===');
    const refTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'ref' 
      ORDER BY table_name
    `);
    refTables.rows.forEach(row => console.log(`  - ref.${row.table_name}`));

    // 4. DRL SCHEMA
    console.log('\n=== DRL SCHEMA TABLES ===');
    const drlTables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'drl' 
      ORDER BY table_name
    `);
    drlTables.rows.forEach(row => console.log(`  - drl.${row.table_name}`));

    // 5. DETAILED COLUMN INFO FOR KEY TABLES
    console.log('\n\n========================================');
    console.log('   DETAILED COLUMN INFORMATION');
    console.log('========================================');

    const tablesToCheck = [
      { schema: 'auth', table: 'roles' },
      { schema: 'auth', table: 'user_accounts' },
      { schema: 'auth', table: 'user_account_profile' },
      { schema: 'auth', table: 'user_account_role' },
      { schema: 'ref', table: 'faculties' },
      { schema: 'ref', table: 'teachers' },
      { schema: 'ref', table: 'students' },
      { schema: 'ref', table: 'classes' },
      { schema: 'ref', table: 'term' },
      { schema: 'drl', table: 'criterion' },
      { schema: 'drl', table: 'self_assessment' },
      { schema: 'drl', table: 'term_score' }
    ];

    for (const { schema, table } of tablesToCheck) {
      console.log(`\n--- ${schema}.${table} ---`);
      const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `, [schema, table]);
      console.table(cols.rows);
    }

    // 6. SAMPLE DATA
    console.log('\n\n========================================');
    console.log('   SAMPLE DATA');
    console.log('========================================');

    console.log('\n--- auth.roles ---');
    const roles = await client.query('SELECT * FROM auth.roles ORDER BY id');
    console.table(roles.rows);

    console.log('\n--- ref.faculties ---');
    const faculties = await client.query('SELECT * FROM ref.faculties ORDER BY id');
    console.table(faculties.rows);

    console.log('\n--- ref.term ---');
    const terms = await client.query('SELECT * FROM ref.term ORDER BY id');
    console.table(terms.rows);

    console.log('\n--- User Accounts (first 5) ---');
    const users = await client.query(`
      SELECT ua.id, ua.username, uap.student_id, uap.teacher_id, uap.faculty_id
      FROM auth.user_accounts ua
      LEFT JOIN auth.user_account_profile uap ON ua.id = uap.user_id
      ORDER BY ua.id
      LIMIT 5
    `);
    console.table(users.rows);

    console.log('\n--- User Roles ---');
    const userRoles = await client.query(`
      SELECT uar.user_account_id, ua.username, r.name as role_name
      FROM auth.user_account_role uar
      JOIN auth.user_accounts ua ON uar.user_account_id = ua.id
      JOIN auth.roles r ON uar.role_id = r.id
      ORDER BY uar.user_account_id
    `);
    console.table(userRoles.rows);

    // 7. CONSTRAINTS
    console.log('\n\n========================================');
    console.log('   KEY CONSTRAINTS');
    console.log('========================================');

    console.log('\n--- ref.classes Foreign Keys ---');
    const classFKs = await client.query(`
      SELECT
        tc.constraint_name,
        kcu.column_name,
        ccu.table_name AS foreign_table,
        ccu.column_name AS foreign_column
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'ref'
        AND tc.table_name = 'classes'
    `);
    console.table(classFKs.rows);

    console.log('\n--- drl.self_assessment Unique Constraint ---');
    const uniqueConst = await client.query(`
      SELECT tc.constraint_name, kcu.column_name, kcu.ordinal_position
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema = 'drl' 
        AND tc.table_name = 'self_assessment'
        AND tc.constraint_type = 'UNIQUE'
      ORDER BY tc.constraint_name, kcu.ordinal_position
    `);
    console.table(uniqueConst.rows);

    console.log('\n========================================');
    console.log('   DATABASE READ COMPLETE');
    console.log('========================================\n');

  } catch (error) {
    console.error('Error reading database:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

readFullDatabase();
