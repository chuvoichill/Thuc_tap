 import pool from "../../db.js";

 //695 Lay danh sach hoc ki 
 export const getAdSemester = async () =>{
   const query = `select * from ref.term order by year desc, semester desc limit 8`;

   const {rows} = await pool.query(query);
   return rows;
 };

 //Tạo mới học kì
export const postAdSemester = async (code, title, year, semester, start_date, end_date, is_active) =>{
   const query = `INSERT INTO ref.term (code, title, year, semester, start_date, end_date, is_active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING *`;

   const {rows} = await pool.query(query,[code, title, year, semester, start_date, end_date, is_active]);
   return rows;
 };

 //Cập nhật học kì
export const putAdSemester = async ( title, year, semester, start_date, end_date, is_active, termCode) =>{
   const query = `UPDATE ref.term
       SET title = $1,year = $2,semester = $3, start_date = $4, end_date = $5,  is_active = $6
       WHERE code = $7
       RETURNING *`;

   const {rows} = await pool.query(query,[title, year, semester, start_date, end_date, is_active,termCode]);
   return rows;
 };

 //Xóa học kì
export const deletdeAdSemester = async (termCode) =>{
   const {rows} = await pool.query(`DELETE FROM ref.term WHERE code = $1`, [termCode]);
   return rows;
 };

 export const putAdSemesterStatus = async (isOpen, termCode) =>{
   const query = `UPDATE ref.term SET is_active = $1 WHERE code = $2 RETURNING code, is_active`;

   const {rows} = await pool.query(query,[isOpen, termCode]);
   return rows;
 };