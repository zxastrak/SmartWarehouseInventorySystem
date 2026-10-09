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
        const sql = 'SELECT * FROM attendance_logs WHERE user_id = ? ORDER BY scan_time DESC';
        const [rows] = await db.query(sql, [user_id]);
        return rows;
    },

    getAll: async () => {
        const sql = 'SELECT * FROM attendance_logs ORDER BY scan_time DESC';
        const [rows] = await db.query(sql);
        return rows;
    },
};

module.exports = attendanceModel;