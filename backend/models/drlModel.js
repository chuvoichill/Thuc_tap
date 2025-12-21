import pool from '../db.js';

//Lấy danh sách tiêu chí DRL
export const getCriteria = async (term) =>{
    const query = `select c.id, c.term_code, c.code, c.title, c.type, c.max_points, c.requires_evidence, cg.title as group_title,cg.code as group_code,
      coalesce((
        select json_agg(
          json_build_object(
            'id', o.id,
            'label', o.label,
            'score', o.score
          )
          ORDER BY o.id
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
    `;
    const { rows } = await pool.query(query, [term]);
    return rows;
};

//Lấy danh sách tự đánh giá DRL của sinh viên
export const getSelfAssessment_student = async (student_code,term) =>{
  const query = `select sa.criterion_id, sa.option_id, sa.text_value, sa.self_score
    from drl.self_assessment sa join ref.students s 
    on s.id = sa.student_id
    where s.student_code = $1 and sa.term_code = $2
    order by sa.criterion_id`;
  const { rows } = await pool.query(query, [student_code, term]);
  return rows;
};

//Lưu thông tin đánh giá DRL sinh viên
export const postSelfAssessment = async (student_code, term_code, items , user_id, role, note) =>{
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
      VALUES ($1, $2, $3, $4, $5, $6, now())
      ON CONFLICT (student_id, term_code, role)
      DO UPDATE SET
        total_score = EXCLUDED.total_score,
        changed_by = EXCLUDED.changed_by,
        note = EXCLUDED.note,
        updated_at = now()`,
      [term_code,student_id, sumPoint,user_id,role,note]
  );

};

//Lịch sử đánh giá
export const getHistoryAss = async (student_code) => {
  const query = `select ts.term_code,ts.total_score, ts.rank
    from drl.term_score ts
    inner join ref.students s on ts.student_id = s.id
    inner join ref.term t on ts.term_code = t.code
    where s.student_code = $1
    order by t.year desc, t.semester desc`;
  const {rows} = await pool.query(query,[student_code]);
  return rows;

};
