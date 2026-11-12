const db = require('../config/db');

const auditLogModel = {
  create: async (logData) => {
    const { user_id, action, table_affected, record_id } = logData;
    const sql = 'INSERT INTO audit_logs (user_id, action, table_affected, record_id) VALUES (?, ?, ?, ?)';
    const [result] = await db.query(sql, [user_id, action, table_affected, record_id]);
    return result;
  },

  getAll: async () => {
    const sql = `
      SELECT al.*, 
             u.name AS user_name, 
             u.email AS user_email, 
             u.role AS user_role,
             inb.inbound_number,
             inb.scanned_barcodes,
             inb.units AS inbound_units,
             inb.supplier_name AS inbound_supplier,
             p.sku AS product_sku,
             p.name AS product_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN inbound_shipments inb ON al.table_affected = 'inbound_shipments' AND al.record_id = inb.id
      LEFT JOIN products p ON al.table_affected = 'products' AND al.record_id = p.id
      ORDER BY al.created_at DESC, al.id DESC
    `;
    const [rows] = await db.query(sql);
    return rows;
  },

  getByUserId: async (user_id) => {
    const sql = `
      SELECT al.*, 
             u.name AS user_name, 
             u.email AS user_email, 
             u.role AS user_role,
             inb.inbound_number,
             inb.scanned_barcodes,
             inb.units AS inbound_units,
             inb.supplier_name AS inbound_supplier,
             p.sku AS product_sku,
             p.name AS product_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN inbound_shipments inb ON al.table_affected = 'inbound_shipments' AND al.record_id = inb.id
      LEFT JOIN products p ON al.table_affected = 'products' AND al.record_id = p.id
      WHERE al.user_id = ?
      ORDER BY al.created_at DESC, al.id DESC
    `;
    const [rows] = await db.query(sql, [user_id]);
    return rows;
  },

  getByAction: async (action) => {
    const sql = `
      SELECT al.*, 
             u.name AS user_name, 
             u.email AS user_email, 
             u.role AS user_role,
             inb.inbound_number,
             inb.scanned_barcodes,
             inb.units AS inbound_units,
             inb.supplier_name AS inbound_supplier,
             p.sku AS product_sku,
             p.name AS product_name
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      LEFT JOIN inbound_shipments inb ON al.table_affected = 'inbound_shipments' AND al.record_id = inb.id
      LEFT JOIN products p ON al.table_affected = 'products' AND al.record_id = p.id
      WHERE al.action = ?
      ORDER BY al.created_at DESC, al.id DESC
    `;
    const [rows] = await db.query(sql, [action]);
    return rows;
  },
};

module.exports = auditLogModel;