const db = require('../config/db');

const attendanceModel = {
    checkIn: async (user_id) => {
        const sql = "INSERT INTO attendance_logs (user_id, type) VALUES (?, 'check_in')";
        const [result] = await db.query(sql, [user_id]);
        return result;
    },

    checkOut: async (user_id) => {
        const sql = "INSERT INTO attendance_logs (user_id, type) VALUES (?, 'check_out')";
        const [result] = await db.query(sql, [user_id]);
        return result;
    },

    getByUserId: async (user_id) => {
        const sql = `
            SELECT a.*, 
                   u.name AS user_name, 
                   u.email AS user_email, 
                   u.role AS user_role, 
                   u.role_title AS user_role_title
            FROM attendance_logs a
            LEFT JOIN users u ON a.user_id = u.id
            WHERE a.user_id = ?
            ORDER BY a.scan_time DESC, a.id DESC
        `;
        const [rows] = await db.query(sql, [user_id]);
        return rows;
    },

    getLastByUserId: async (user_id) => {
        const sql = 'SELECT * FROM attendance_logs WHERE user_id = ? ORDER BY scan_time DESC, id DESC LIMIT 1';
        const [rows] = await db.query(sql, [user_id]);
        return rows;
    },

    getAll: async () => {
        const sql = `
            SELECT a.*, 
                   u.name AS user_name, 
                   u.email AS user_email, 
                   u.role AS user_role, 
                   u.role_title AS user_role_title
            FROM attendance_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.scan_time DESC, a.id DESC
        `;
        const [rows] = await db.query(sql);
        return rows;
    },
};

module.exports = attendanceModel;