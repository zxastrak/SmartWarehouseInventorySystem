const db = require('../config/db');

const userModel = {
  create: async (userData) => {
    const { name, email, password, role } = userData;
    const sql = 'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(sql, [name, email, password, role]);
    return result;
  },

  findByEmail: async (email) => {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const [rows] = await db.query(sql, [email]);
    return rows;
  },

  findById: async (id) => {
    const sql = 'SELECT id, name, email, role, created_at FROM users WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },
};

module.exports = userModel;