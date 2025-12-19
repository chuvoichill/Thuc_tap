import pool from "../db.js";

export const getStudentClass = async (username, term) => {
    const query = ` SELECT s.student_code,s.name AS full_name,ah.total_score AS total_score,ahSV.total_score AS old_score
	    FROM ref.students leader
	    JOIN ref.students s ON s.class_id = leader.class_id
	    LEFT JOIN drl.assessment_history ahSV ON ahSV.student_id = s.id AND ahSV.term_code = $2 AND ahSV.role = 'student'
	    LEFT JOIN drl.assessment_history ah ON ah.student_id = s.id AND ah.term_code = $2 AND ah.role = 'leader'
	    WHERE leader.student_code = $1 AND leader.is_class_leader = true
	    ORDER BY s.student_code`;
    const {rows} = await pool.query(query,[username, term]);
    return rows;
};


