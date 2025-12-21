import pool from "../db.js";

export const getStudentClass = async (username, term) => {
    const query = `SELECT s.student_code,s.name,ah.total_score AS total_score,ahSV.total_score AS old_score
	    FROM ref.students leader
	    JOIN ref.students s ON s.class_id = leader.class_id
	    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 AND ahSV.role = 'student'
	    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 AND ah.role = 'leader'
	    WHERE leader.student_code = $1 AND leader.is_class_leader = true
	    ORDER BY s.student_code`;
    const {rows} = await pool.query(query,[username, term]);
    console.log(rows);
    return rows;
};

export const postLeaderAssessment = async (student_code, term_code, items , user_id, note) =>{
  const studentID = await pool.query("select id from ref.students where student_code = $1",[student_code]);

  if (studentID.rowCount === 0) {
    throw new Error("Student_404");
  }

  const student_id = studentID.rows[0].id;

  for (const it of items) {
    //lưu các đánh giá vào self_assessment và các bảng liên quan
    await pool.query(
      `INSERT INTO drl.self_assessment (student_id, term_code, criterion_id, option_id, text_value, self_score, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (student_id, criterion_id, term_code)
      DO UPDATE SET 
        option_id = EXCLUDED.option_id,
        text_value = EXCLUDED.text_value,
        self_score = EXCLUDED.self_score,
        updated_at = now()`,      
        [student_id, term_code, it.criterion_id, it.option_id || null, it.text_value || null, it.score || 0]);
  }

  //Tính tổng điểm
  const sumPoint = items.reduce((sum, x) => sum + (x.score || 0), 0);
  
  await pool.query(
    `INSERT INTO drl.assessment_history ( term_code,student_id, total_score, changed_by, role, note, updated_at)
      VALUES ($1, $2, $3, $4, 'leader', $5, now())
      ON CONFLICT (student_id, term_code, role)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        changed_by = EXCLUDED.changed_by,
        note = EXCLUDED.note,
        updated_at = now()`,
      [term_code,student_id, sumPoint,user_id,note]
  );

};


