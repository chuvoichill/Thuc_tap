import pool from '../db.js';

export const getTerm = async ()=> {
    const {rows} = await pool.query(`SELECT code, title, year, semester, is_active FROM ref.term
        ORDER BY year DESC, semester DESC
        Limit 3`);
    return rows;
}; 

export const getTerm_Status = async (termCode) => {
    const {rows} = await pool.query(`SELECT is_active FROM ref.term WHERE code = $1`, [termCode]);
    return rows;
};