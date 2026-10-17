const db = require('../config/db');

const SAFE_COLUMNS = 'id, name, email, role, is_active, created_at, updated_at';

const UserModel = {
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

  // Tidak mengambil kolom password
  findById: async (id) => {
    const sql = `SELECT ${SAFE_COLUMNS} FROM users WHERE id = ?`;
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  // Daftar akun (tanpa password), opsional difilter per role
  getAll: async (role) => {
    if (role) {
      const [rows] = await db.query(`SELECT ${SAFE_COLUMNS} FROM users WHERE role = ? ORDER BY id`, [role]);
      return rows;
    }
    const [rows] = await db.query(`SELECT ${SAFE_COLUMNS} FROM users ORDER BY id`);
    return rows;
  },

  update: async (id, userData) => {
    const { name, email } = userData;
    const sql = 'UPDATE users SET name = ?, email = ? WHERE id = ?';
    const [result] = await db.query(sql, [name, email, id]);
    return result;
  },

  setActive: async (id, isActive) => {
    const sql = 'UPDATE users SET is_active = ? WHERE id = ?';
    const [result] = await db.query(sql, [isActive ? 1 : 0, id]);
    return result;
  },

  updatePassword: async (id, hashedPassword) => {
    const sql = 'UPDATE users SET password = ? WHERE id = ?';
    const [result] = await db.query(sql, [hashedPassword, id]);
    return result;
  },
};

module.exports = UserModel;