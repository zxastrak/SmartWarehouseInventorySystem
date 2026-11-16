const db = require('../config/db');

const supplierModel = {
  create: async (supplierData) => {
    const { name, contact_person, email, phone, address, bank_name, bank_account, bank_holder } = supplierData;
    const sql = 'INSERT INTO suppliers (name, contact_person, email, phone, address, bank_name, bank_account, bank_holder) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const [result] = await db.query(sql, [
      name,
      contact_person || null,
      email || null,
      phone || null,
      address || null,
      bank_name || null,
      bank_account || null,
      bank_holder || null,
    ]);
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
    const { name, contact_person, email, phone, address, bank_name, bank_account, bank_holder } = supplierData;
    const sql = 'UPDATE suppliers SET name = ?, contact_person = ?, email = ?, phone = ?, address = ?, bank_name = ?, bank_account = ?, bank_holder = ? WHERE id = ?';
    const [result] = await db.query(sql, [
      name,
      contact_person || null,
      email || null,
      phone || null,
      address || null,
      bank_name || null,
      bank_account || null,
      bank_holder || null,
      id,
    ]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM suppliers WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = supplierModel;