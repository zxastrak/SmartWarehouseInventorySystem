const db = require('../config/db');

const unitModel = {
  getAll: async () => {
    const sql = 'SELECT * FROM units ORDER BY id ASC';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM units WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows[0] || null;
  },

  getByName: async (name) => {
    const sql = 'SELECT * FROM units WHERE LOWER(name) = LOWER(?) LIMIT 1';
    const [rows] = await db.query(sql, [name.trim()]);
    return rows[0] || null;
  },

  create: async ({ name, label, description = '', default_weight_kg = null }) => {
    const cleanName = name.trim().toLowerCase();
    const cleanLabel = label ? label.trim() : cleanName;
    const cleanWeight = default_weight_kg ? Number(default_weight_kg) : null;
    const sql = `
      INSERT INTO units (name, label, description, default_weight_kg)
      VALUES (?, ?, ?, ?)
    `;
    const [result] = await db.query(sql, [cleanName, cleanLabel, description.trim(), cleanWeight]);
    return result.insertId;
  },

  update: async (id, { name, label, description = '', default_weight_kg = null }) => {
    const cleanName = name.trim().toLowerCase();
    const cleanLabel = label ? label.trim() : cleanName;
    const cleanWeight = default_weight_kg ? Number(default_weight_kg) : null;
    const sql = `
      UPDATE units 
      SET name = ?, label = ?, description = ?, default_weight_kg = ?
      WHERE id = ?
    `;
    const [result] = await db.query(sql, [cleanName, cleanLabel, description.trim(), cleanWeight, id]);
    return result.affectedRows;
  },

  delete: async (id) => {
    const sql = 'DELETE FROM units WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result.affectedRows;
  },
};

module.exports = unitModel;
