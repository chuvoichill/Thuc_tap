import pool from '../db.js';

//Lấy danh sách tiêu chí DRL
export const getCriteria = async (term) =>{
    const query = `select c.id, c.term_code, c.code, c.title, c.type,c.max_points,cg.title as group_title,
      coalesce((
        select json_agg(
          json_build_object(
            'id', o.id,
            'label', o.label,
            'score', o.score
          )
          order by o.id
        )
        from drl.criterion_option o
        where o.criterion_id = c.id
      ), '[]'::json) as options,
      
      --Tách phần số của code để sắp xếp
      nullif(regexp_replace(split_part(c.code, '.', 1), '\\D', '', 'g'), '')::int as grp_order,
      nullif(regexp_replace(split_part(c.code, '.', 2), '\\D', '', 'g'), '')::int as sub_order
    from drl.criterion c inner join drl.criteria_group cg
    on c.group_id = cg.id
    where c.term_code = $1
    order by grp_order nulls last, sub_order nulls last, c.id;
    `
    const { rows } = await pool.query(query, [term]);
    return rows;
};

//Lấy danh sách tự đánh giá DRL của sinh viên
export const getSelfAssessment_student = async (student_code,term) =>{
  const query = `select sa.criterion_id, sa.option_id, sa.text_value, sa.self_score,sa.is_hsv_verified, sa.hsv_note
    from drl.self_assessment sa join ref.student s 
    on s.id = sa.student_id
    where s.student_code = $1 and sa.term_code = $2
    order by sa.criterion_id;
  `
  const { rows } = await pool.query(query, [student_code, term]);
  return rows;
};

//Lưu thông tin đánh giá DRL sinh viên
export const postSelfAssessment = async (student_code, term_code, items) =>{
  const studentID = await pool.query("select id from ref.student where student_code = $1",[student_code])

  if (studentID.rowCount === 0) {
    throw new Error("Student_404");
  }

  const student_id = studentID.rows[0].id;

  // Lấy criterion_id của tiêu chí text
  const criteriaText = await pool.query(
    `select id from drl.criterion where code = '2.1' and term_code = $1 limit 1`,
    [term_code]
  );

  const criterionID = criteriaText.rows[0]?.id;
  
  for (const it of items) {
    const is21 = (it.criterion_id == criterionID);

    if (is21) {
      if ((it.score > 0) && (!it.text_value || it.text_value.trim() === "")) {
        throw new Error("Điểm 2.1 > 0 thì phải ghi nội dung tham gia CLB hoặc hoạt động!");
      }

      if ((!it.text_value || it.text_value.trim() === "") && (!it.score || it.score == 0)) {
        // Không tham gia -> text null, score = 0
        it.text_value = null;
        it.score = 0;
      }
    }
    //lưu các đánh giá vào self_assessment và các bảng liên quan
    await pool.query(
      `insert into drl.self_assessment (student_id, term_code, criterion_id, option_id, text_value, self_score, updated_at)
      values ($1, $2, $3, $4, $5, $6, now())
      on conflict (student_id, term_code, criterion_id)
      do update set 
        option_id = excluded.option_id,
        text_value = excluded.text_value,
        self_score = excluded.self_score,
        updated_at = now(); `,
      
        [
        student_id,
        term_code,
        it.criterion_id,
        it.option_id || null,
        it.text_value || null,
        it.score || 0,
      ]
    );
  }

  //Tính tổng và lưu điểm 
  const sumPoint = items.reduce((sum, x) => sum + (x.score || 0), 0);

  await pool.query(
    `insert into drl.term_score (student_id, term_code, total_score, updated_at)
      values ($1, $2, $3, now())
      on conflict (student_id, term_code)
      do update set total_score = $3, updated_at = now();`,
    [student_id, term_code, sumPoint]
  );

  return { message: "Lưu thành công đánh giá", student_id, sumPoint };

};
