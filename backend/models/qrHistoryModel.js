const db = require('../config/db');

const qrHistoryModel = {
  create: async ({ user_id = null, qr_type, code, name, action, details = null }) => {
    const detailsStr = details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null;
    const sql = `
      INSERT INTO qr_histories (user_id, qr_type, code, name, action, details)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [user_id, qr_type, code, name, action, detailsStr]);
    return result.insertId;
  },

  getAll: async (limit = 100) => {
    const sql = `
      SELECT qh.*, u.name AS user_name
      FROM qr_histories qh
      LEFT JOIN users u ON qh.user_id = u.id
      ORDER BY qh.created_at DESC, qh.id DESC
      LIMIT ?
    `;
    const [rows] = await db.query(sql, [Number(limit) || 100]);
    return rows.map((row) => {
      let parsedDetails = {};
      if (row.details) {
        try {
          parsedDetails = typeof row.details === 'string' ? JSON.parse(row.details) : row.details;
        } catch {
          parsedDetails = {};
        }
      }
      return {
        ...row,
        details: parsedDetails,
      };
    });
  },

  deleteById: async (id) => {
    const sql = 'DELETE FROM qr_histories WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result.affectedRows;
  },

  clearAll: async () => {
    const sql = 'TRUNCATE TABLE qr_histories';
    const [result] = await db.query(sql);
    return result;
  },
};

module.exports = qrHistoryModel;
