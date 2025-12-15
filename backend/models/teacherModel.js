import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (username, term) =>{
  const query = `
    SELECT s.student_code, s.name as full_name, c.name as class_name, ts.total_score
    FROM ref.teachers t
    JOIN ref.classes c ON c.teacher_id = t.id
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE t.teacher_code = $1 
    ORDER BY c.name, s.student_code
  `;

  const {rows}= await pool.query(query,[username, term]);
  return rows;
}; 

export const getStudentsNot = async (username, term) => {
  const query = `
    SELECT s.student_code, s.name as full_name, c.name as class_name
    FROM ref.teachers t
    JOIN ref.classes c ON c.teacher_id = t.id
    JOIN ref.students s ON s.class_id = c.id
    LEFT JOIN drl.term_score ts ON ts.student_id = s.id AND ts.term_code = $2
    WHERE t.teacher_code = $1 AND ts.total_score IS NULL
    ORDER BY c.name, s.student_code
  `;
  const {rows}= await pool.query(query,[username, term]);
  return rows;
};

export const postStudentAllNotAssessment = async (username, term)=>{
  //Danh sách sinh viên chưa đánh giá  
  const allStudentNot = await getStudentsNot(username, term);

  //Lấy tiêu chí trong kì
  const criteria = await pool.query(`SELECT id FROM drl.criterion WHERE term_code = $1`,[term]);
  const criteriaIDs = criteria.rows.map(r => r.id);

  //Lặp với những sinh viên chưa đánh giá
  for (let i = 0; i < allStudentNot.length; i++) {
    const student = allStudentNot[i];
    const studentid = await pool.query(`SELECT id FROM ref.students WHERE student_code = $1`,[student.student_code]);

    const student_id = studentid.rows[0].id;

    //Tự đánh giá
    for (let j = 0; j < criteriaIDs.length; j++) {
      const cri = criteriaIDs[j];
      await pool.query(`INSERT INTO drl.self_assessment (student_id, term_code, criterion_id, self_score, updated_at)
        VALUES ($1, $2, $3, 0, now())`, [student_id, term, cri]);
    }

    //Tính tổng điểm
    await pool.query(`INSERT INTO drl.term_score (student_id, term_code, total_score, updated_at, rank)
      VALUES ($1, $2, 0, now(), drl.rank_by_score(0))`, [student_id, term]);
  }

  return ;
};