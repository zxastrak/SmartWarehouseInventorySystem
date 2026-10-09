const db = require('../config/db');

const shiftModel = {
    create: async (shiftData) => {
        const { user_id, shift_date, start_time, end_time } = shiftData;
        const sql = 'INSERT INTO shifts (user_id, shift_date, start_time, end_time) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(sql, [user_id, shift_date, start_time, end_time]);
        return result;
    },

    getAll: async () => {
        const sql = 'SELECT * FROM shifts ORDER BY shift_date DESC';
        const [rows] = await db.query(sql);
        return rows;
    },

    getById: async (id) => {
        const sql = 'SELECT * FROM shifts WHERE id = ?';
        const [rows] = await db.query(sql, [id]);
        return rows;
    },

    // Dipake buat jawab "siapa yang lagi shift hari ini" pas Staf login/transaksi
    getByUserAndDate: async (user_id, shift_date) => {
        const sql = 'SELECT * FROM shifts WHERE user_id = ? AND shift_date = ?';
        const [rows] = await db.query(sql, [user_id, shift_date]);
        return rows;
    },

    update: async (id, shiftData) => {
        const { user_id, shift_date, start_time, end_time } = shiftData;
        const sql = 'UPDATE shifts SET user_id = ?, shift_date = ?, start_time = ?, end_time = ? WHERE id = ?';
        const [result] = await db.query(sql, [user_id, shift_date, start_time, end_time, id]);
        return result;
    },

    remove: async (id) => {
        const sql = 'DELETE FROM shifts WHERE id = ?';
        const [result] = await db.query(sql, [id]);
        return result;
    },
};

module.exports = shiftModel;