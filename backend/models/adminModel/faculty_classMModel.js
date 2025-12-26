import pool from "../../db.js";
import { withTransaction } from '../../utils/helpers.js';

export const getfaculty = async (term) =>{
    const query = `SELECT s.student_code,s.name as full_name,c.name as class_name, f.name as faculty_name, ah.total_score, ahSV.total_score as old_score, ah.note
      FROM ref.faculties f
      join ref.classes c on f.id = c.faculty_id 
      JOIN ref.students s ON s.class_id = c.id
      LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $1 and ahSV.role ='faculty'
      LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $1 and ah.role ='admin'
      ORDER BY f.name, s.student_code`;

    const {rows} = await pool.query(query,[term]);
    return rows;
};

export const getStudent = async (class_code,term) =>{
    const query = `select s.student_code, s.name as full_name, c.name as class_name,
        coalesce(ts.total_score, 0)::int as total_score
        from ref.classes c
        join ref.students s on s.class_id = c.id
        left join drl.term_score ts on ts.student_id = s.id and ts.term_code = $2
        where c.name = $1
        order by s.student_code`;

    const {rows} = await pool.query(query,[class_code,term]);
    return rows;
};

export const postAccept = async (term, user_id) => {
  return withTransaction(async (client) => {
    const facultyAss = await getfaculty(term);

    for (const student of facultyAss) {
      const totalScore = student.total_score !== null
        ? student.total_score      // Admin đã chấm
        : student.old_score;       // lấy điểm Khoa

      if (totalScore !== null) {
        // Tính rank dựa trên điểm
        let rank = 'Kém';
        if (totalScore >= 90) rank = 'Xuất sắc';
        else if (totalScore >= 80) rank = 'Tốt';
        else if (totalScore >= 65) rank = 'Khá';
        else if (totalScore >= 50) rank = 'Trung bình';
        else if (totalScore >= 35) rank = 'Yếu';

        await client.query(
          `INSERT INTO drl.term_score(student_id, term_code, total_score, rank, created_at, updated_at)
           VALUES ((SELECT id FROM ref.students WHERE student_code = $1), $2, $3, $4, now(), now())
           ON CONFLICT (student_id, term_code)
           DO UPDATE SET
             total_score = EXCLUDED.total_score,
             rank = EXCLUDED.rank,
             updated_at = now()`,
          [student.student_code, term, totalScore, rank]
        );
      }
    }
  });
};
