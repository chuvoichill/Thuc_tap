import pool from "../../db.js";
import {getConfig}  from "../../utils/helpers.js";


//108 Lấy danh sách nhóm tiêu chí
export const getGroupCri = async (term) =>{
  const query =`SELECT * FROM drl.criteria_group WHERE term_code = $1 ORDER BY code`;
  const {rows} =  await pool.query(query,[term]);
  return rows;
};

//123 Tạo mới nhóm tiêu chí
export const postGroupCri = async(term_code, code, title)=>{
  const query = `insert into drl.criteria_group (term_code, code, title)
                    values ($1,$2,$3)
                    returning *`;
  const {rows} = await pool.query(query,[term_code, code, title]);
  return rows;
};

//140 Cập nhật nhóm tiêu chí
export const putGroupCri = async ()=>{
  
};