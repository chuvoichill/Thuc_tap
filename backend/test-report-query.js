import pool from './db.js';

async function testReportQuery() {
  try {
    console.log('Testing reportFaculty query...\n');
    
    const term_code = 'test';
    const faculty_code = 'CNTT';
    
    console.log('Parameters:', { term_code, faculty_code });
    
    const query = `select s.student_code, s.name as full_name, c.name as class_name, f.name, ts.total_score, ts.rank, t.semester, t.year
        from ref.term t join drl.term_score ts on t.code = ts.term_code
        left join ref.students s on ts.student_id = s.id 
        left join ref.classes c on s.class_id = c.id 
        left join ref.faculties f on c.faculty_id = f.id
        where ts.term_code = $1 and f.faculty_code = $2
        order by f.faculty_code, c.name, s.student_code`;
    
    const { rows } = await pool.query(query, [term_code, faculty_code]);
    
    console.log(`\nFound ${rows.length} rows`);
    if (rows.length > 0) {
      console.table(rows.slice(0, 3));
    } else {
      console.log('No data found. Checking term_score table...');
      const check = await pool.query('SELECT * FROM drl.term_score WHERE term_code = $1 LIMIT 3', [term_code]);
      console.log(`\nterm_score has ${check.rows.length} rows for term '${term_code}':`);
      console.table(check.rows);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await pool.end();
  }
}

testReportQuery();
