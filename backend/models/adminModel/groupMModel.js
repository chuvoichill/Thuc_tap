import pool from "../db.js";

//114 Lấy danh sách nhóm tiêu chí
export const getGroup = async () =>{
    const query =``;

    const {rows} = await pool.query(query,);
    return rows;
};