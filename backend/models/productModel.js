const db = require('../config/db');
const locationModel = require('./locationModel');

const productModel = {
  create: async (productData) => {
    let { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id, image_url, description } = productData;

    // 1. Validasi foreign key category_id agar tidak melempar error constraint
    if (category_id) {
      const [catRows] = await db.query('SELECT id FROM categories WHERE id = ?', [category_id]);
      if (catRows.length === 0) {
        const [anyCats] = await db.query('SELECT id FROM categories LIMIT 1');
        category_id = anyCats.length > 0 ? anyCats[0].id : null;
      }
    } else {
      category_id = null;
    }

    // 2. Validasi foreign key supplier_id
    if (supplier_id) {
      const [supRows] = await db.query('SELECT id FROM suppliers WHERE id = ?', [supplier_id]);
      if (supRows.length === 0) {
        const [anySups] = await db.query('SELECT id FROM suppliers LIMIT 1');
        supplier_id = anySups.length > 0 ? anySups[0].id : null;
      }
    } else {
      supplier_id = null;
    }

    // 3. Derive zone_location otomatis dari location_id jika ada
    let zone_location = null;
    if (location_id) {
      const location = await locationModel.getById(location_id);
      if (location && location.length > 0) {
        zone_location = location[0].location_code;
      } else {
        location_id = null;
      }
    }

    const sql = `INSERT INTO products 
      (name, sku, category_id, supplier_id, stock_quantity, unit, price, zone_location, location_id, image_url, description) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const [result] = await db.query(sql, [
      name,
      sku,
      category_id,
      supplier_id,
      stock_quantity || 0,
      unit || 'pcs',
      price || 0,
      zone_location,
      location_id,
      image_url || null,
      description || null,
    ]);
    return result;
  },

  getAll: async () => {
    const sql = `
      SELECT p.*, 
             c.name AS category_name, 
             s.name AS supplier_name,
             l.location_code AS location_code,
             l.zone AS zone
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN locations l ON p.location_id = l.id
      ORDER BY p.id DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
  },

  getById: async (id) => {
    const sql = `
      SELECT p.*, 
             c.name AS category_name, 
             s.name AS supplier_name,
             l.location_code AS location_code,
             l.zone AS zone
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE p.id = ?
    `;
    const [rows] = await db.query(sql, [id]);
    return rows;
  },

  // Khusus buat Skenario B (Staf scan barcode) — cari produk by SKU
  findBySku: async (sku) => {
    const sql = `
      SELECT p.*, 
             c.name AS category_name, 
             s.name AS supplier_name,
             l.location_code AS location_code,
             l.zone AS zone
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN suppliers s ON p.supplier_id = s.id
      LEFT JOIN locations l ON p.location_id = l.id
      WHERE p.sku = ?
    `;
    const [rows] = await db.query(sql, [sku]);
    return rows;
  },

  update: async (id, productData) => {
    let { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id, image_url, description } = productData;

    if (category_id) {
      const [catRows] = await db.query('SELECT id FROM categories WHERE id = ?', [category_id]);
      if (catRows.length === 0) {
        const [anyCats] = await db.query('SELECT id FROM categories LIMIT 1');
        category_id = anyCats.length > 0 ? anyCats[0].id : null;
      }
    }

    if (supplier_id) {
      const [supRows] = await db.query('SELECT id FROM suppliers WHERE id = ?', [supplier_id]);
      if (supRows.length === 0) {
        supplier_id = null;
      }
    }

    let zone_location = null;
    if (location_id) {
      const location = await locationModel.getById(location_id);
      if (location && location.length > 0) {
        zone_location = location[0].location_code;
      } else {
        location_id = null;
      }
    }

    const sql = `UPDATE products SET 
      name = ?, sku = ?, category_id = ?, supplier_id = ?, stock_quantity = ?, 
      unit = ?, price = ?, zone_location = ?, location_id = ?, image_url = ?, description = ?
    WHERE id = ?`;
    const [result] = await db.query(sql, [
      name,
      sku,
      category_id,
      supplier_id,
      stock_quantity || 0,
      unit || 'pcs',
      price || 0,
      zone_location,
      location_id,
      image_url || null,
      description || null,
      id,
    ]);
    return result;
  },

  // Khusus buat SKU IN/OUT — update stock_quantity doang
  updateStock: async (id, newQuantity) => {
    const sql = 'UPDATE products SET stock_quantity = ? WHERE id = ?';
    const [result] = await db.query(sql, [newQuantity, id]);
    return result;
  },

  updateLocation: async (id, zone_location, location_id = null) => {
    let locId = location_id;
    if (!locId && zone_location) {
      const [locRows] = await db.query('SELECT id FROM locations WHERE location_code = ?', [zone_location]);
      if (locRows.length > 0) {
        locId = locRows[0].id;
      }
    }
    const sql = 'UPDATE products SET zone_location = ?, location_id = ? WHERE id = ?';
    const [result] = await db.query(sql, [zone_location, locId, id]);
    return result;
  },

  remove: async (id) => {
    const sql = 'DELETE FROM products WHERE id = ?';
    const [result] = await db.query(sql, [id]);
    return result;
  },
};

module.exports = productModel;