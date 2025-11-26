import pool from '../db.js';

//Hiển thị danh sách sinh viên trong lớp 
export const getStudents = async (username, term, class_code ) =>{
  const params = [username.trim(), term];  
  let query = `select s.student_code, s.full_name, c.code as class_code, c.name as class_name,ts.total_score
    from ref.class_advisor ca
    join ref.class c on c.id = ca.class_id
    join ref.student s on s.class_id = c.id
    left join drl.self_assessment sa on sa.student_id = s.id and sa.term_code = $2
    join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
    where ca.advisor_username = $1`;
  if (class_code) {
    query += ' and c.code = $3';
    params.push(class_code.trim());
  }

  query += ` group by s.student_code, s.full_name, c.code, c.name, ts.total_score
            order by c.code, s.student_code `;

  const {rows}= await pool.query(query,params);
  return rows;
}; 

export const getStudentsNot = async (username, term, class_code) => {
  const query =`select s.student_code, s.full_name, c.code as class_code, c.name as class_name
    from ref.class_advisor ca
    join ref.class c on c.id = ca.class_id
    join ref.student s on s.class_id = c.id
    left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
    where ca.advisor_username = $1 and c.code = $3 and ts.total_score IS NULL
    order by c.code, s.student_code;`;

  const {rows}= await pool.query(query,[username, term, class_code]);
  return rows;
};

export const postStudentAllNotAssessment = async (username, term_code, class_code)=>{
  //Danh sách sinh viên chưa đánh giá
  const allStudentNot = await getStudentsNot(username, term_code, class_code);

  //Lấy tiêu chí trong kì
  const criteria = await pool.query(`select id from drl.criterion where term_code = $1`,[term_code]);
  const criteriaIDs = criteria.rows.map(r => r.id);

  //Lặp với những sinh viên chưa đánh giá
  for (let i = 0; i < allStudentNot.length; i++) {
    const student = allStudentNot[i];
    const studentid = await pool.query(`select id from ref.student where student_code = $1`,[student.student_code]);

    const student_id = studentid.rows[0].id;

    //Tự đánh giá
    for (let j = 0; j < criteriaIDs.length; j++) {
      const cri = criteriaIDs[j];
      await pool.query(`insert into drl.self_assessment (student_id, term_code, criterion_id, self_score, updated_at)
        values ($1, $2, $3, 0, now())
        on conflict (student_id, term_code, criterion_id)
        do update set self_score = 0, updated_at = now();`, [student_id, term_code, cri]);
    }

    //Tính tổng điểm
    await pool.query(`insert into drl.term_score (student_id, term_code, total_score, updated_at, rank)
      values ($1, $2, 0, now(), drl.rank_by_score(0))
      on conflict (student_id, term_code)
      do update set total_score = 0, updated_at = now(), rank = drl.rank_by_score(0);`, [student_id, term_code]);
  }

  return {message: "Đã tự đánh giá 0 điểm cho tất cả sinh viên chưa đánh giá",total_students: students.length };
};