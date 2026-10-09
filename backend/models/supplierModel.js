const db = require('../config/db');

const supplierModel = {
  create: async (supplierData) => {
    const { name, contact_person, phone, address } = supplierData;
    const sql = 'INSERT INTO suppliers (name, contact_person, phone, address) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(sql, [name, contact_person, phone, address]);
    return result;
  },

  getAll: async () => {
    const sql = 'SELECT * FROM suppliers';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM suppliers WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  update: async (id, supplierData) => {
    const { name, contact_person, phone, address } = supplierData;
    const sql = 'UPDATE suppliers SET name = ?, contact_person = ?, phone = ?, address = ? WHERE id = ?';
    const [result] = await db.query(sql, [name, contact_person, phone, address, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM suppliers WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = supplierModel;