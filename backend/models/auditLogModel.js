const db = require('../config/db');

const auditLogModel = {
    create: async (logData) => {
        const { user_id, action, table_affected, record_id } = logData;
        const sql = 'INSERT INTO audit_logs (user_id, action, table_affected, record_id) VALUES (?, ?, ?, ?)';
        const [result] = await db.query(sql, [user_id, action, table_affected, record_id]);
        return result;
    },

    getAll: async () => {
        const sql = 'SELECT * FROM audit_logs ORDER BY created_at DESC';
        const [rows] = await db.query(sql);
        return rows;
    },

    getByUserId: async (user_id) => {
        const sql = 'SELECT * FROM audit_logs WHERE user_id = ? ORDER BY created_at DESC';
        const [rows] = await db.query(sql, [user_id]);
        return rows;
    },
};

module.exports = auditLogModel;