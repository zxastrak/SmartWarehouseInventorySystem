const db = require('../config/db');

const categoryModel = {
  create: async (categoryData) => {
    const { name, description } = categoryData;
    const sql = 'INSERT INTO categories (name, description) VALUES (?, ?)';
    const [result] = await db.query(sql, [name, description]);
    return result;
  },

  getAll: async () => {
    const sql = 'SELECT * FROM categories';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM categories WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  update: async (id, categoryData) => {
    const { name, description } = categoryData;
    const sql = 'UPDATE categories SET name = ?, description = ? WHERE id = ?';
    const [result] = await db.query(sql, [name, description, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM categories WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = categoryModel;