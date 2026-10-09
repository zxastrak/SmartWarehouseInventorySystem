const db = require('../config/db');
const locationModel = require('./locationModel');

const productModel = {
  create: async (productData) => {
    const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id } = productData;

    // Derive zone_location otomatis dari location_id, bukan dari input manual
    let zone_location = null;
    if (location_id) {
      const location = await locationModel.getById(location_id);
      if (location.length > 0) {
        zone_location = location[0].location_code;
      }
    }

    const sql = `INSERT INTO products 
    (name, sku, category_id, supplier_id, stock_quantity, unit, price, zone_location, location_id) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [name, sku, category_id, supplier_id, stock_quantity, unit, price, zone_location, location_id]);
    return result;
  },

  getAll: async () => {
    const sql = 'SELECT * FROM products';
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = 'SELECT * FROM products WHERE id = ?';
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  // Khusus buat Skenario B (Staf scan barcode) — cari produk by SKU
  findBySku: async (sku) => {
    const sql = 'SELECT * FROM products WHERE sku = ?';
    const [rows] = await db.query(sql, [sku]);
    return rows;
  },

  update: async (id, productData) => {
    const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id } = productData;

    let zone_location = null;
    if (location_id) {
      const location = await locationModel.getById(location_id);
      if (location.length > 0) {
        zone_location = location[0].location_code;
      }
    }

    const sql = `UPDATE products SET 
    name = ?, sku = ?, category_id = ?, supplier_id = ?, stock_quantity = ?, unit = ?, price = ?, zone_location = ?, location_id = ?
    WHERE id = ?`;
    const [result] = await db.query(sql, [name, sku, category_id, supplier_id, stock_quantity, unit, price, zone_location, location_id, id]);
    return result;
  },

  // Khusus buat SKU IN/OUT — update stock_quantity doang, nggak perlu kirim semua field
  updateStock: async (id, newQuantity) => {
    const sql = 'UPDATE products SET stock_quantity = ? WHERE id = ?';
    const [result] = await db.query(sql, [newQuantity, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = productModel;