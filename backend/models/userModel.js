const db = require('../config/db');

const SAFE_COLUMNS = 'id, name, email, role, role_title, warehouse, photo, is_active, created_at, updated_at';

const UserModel = {
  create: async (userData) => {
    const { name, email, password, role, role_title, warehouse } = userData;
    const sql = 'INSERT INTO users (name, email, password, role, role_title, warehouse) VALUES (?, ?, ?, ?, ?, ?)';
    const [result] = await db.query(sql, [
      name,
      email,
      password,
      role || 'staf',
      role_title || null,
      warehouse || null,
    ]);
    return result;
  },

  findByEmail: async (email) => {
    const raw = String(email || '').trim().toLowerCase();
    const withCom = raw.endsWith('.com') ? raw : `${raw}.com`;
    const withoutCom = raw.replace(/\.com$/, '');
    const sql = 'SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(email) = ? OR LOWER(email) = ?';
    const [rows] = await db.query(sql, [raw, withCom, withoutCom]);
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

  updateName: async (id, name) => {
    const sql = 'UPDATE users SET name = ? WHERE id = ?';
    const [result] = await db.query(sql, [name, id]);
    return result;
  },

  update: async (id, userData) => {
    const fields = [];
    const values = [];

    if (userData.name !== undefined) {
      fields.push('name = ?');
      values.push(userData.name);
    }
    if (userData.email !== undefined) {
      fields.push('email = ?');
      values.push(userData.email);
    }
    if (userData.role_title !== undefined) {
      fields.push('role_title = ?');
      values.push(userData.role_title);
    }
    if (userData.warehouse !== undefined) {
      fields.push('warehouse = ?');
      values.push(userData.warehouse);
    }
    if (userData.photo !== undefined) {
      fields.push('photo = ?');
      values.push(userData.photo);
    }

    if (fields.length === 0) return { affectedRows: 0 };

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    const [result] = await db.query(sql, values);
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