import pool from "../../db.js";

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
export const putGroupCri = async (id, code, title)=>{
  const query = `update drl.criteria_group
                  set code = $1, title = $2
                  where id = $3
                  returning *`;
  const {rows} = await pool.query(query,[code, title,id]);
  return rows;
};

//159 Xóa nhóm tiêu chí
export const deleteGroupCri = async (id) =>{
  //Kiểm tra nhóm tiêu chí có đang dùng không 
  const check = await pool.query(`select 1 from drl.criterion where group_id = $1 limit 1`,[id]);
   if (check.rowCount > 0) {
    const err = new Error("Không thể xóa nhóm tiêu chí vì đang được sử dụng.");
    err.status = 400;
    throw err;
  } 
  
  const {rows} = await pool.query(`delete from drl.criteria_group where id = $1`,[id]);
  return rows;
};