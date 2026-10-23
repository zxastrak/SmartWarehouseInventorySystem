const db = require('../config/db');

const stockTransactionModel = {
  getAll: async () => {
    const sql = `
    SELECT st.*, p.name AS product_name, p.sku
    FROM stock_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    ORDER BY st.created_at DESC
  `;
    const [rows] = await db.query(sql);
    return rows;
  },

  getByProductId: async (product_id) => {
    const sql = `
    SELECT st.*, p.name AS product_name, p.sku
    FROM stock_transactions st
    LEFT JOIN products p ON st.product_id = p.id
    WHERE st.product_id = ?
    ORDER BY st.created_at DESC
  `;
    const [rows] = await db.query(sql, [product_id]);
    return rows;
  },

  // Buat fitur "Riwayat Transaksi Harian Staf"
  getByUserId: async (user_id) => {
    const sql = `
      SELECT st.*, p.name as product_name, p.sku
      FROM stock_transactions st
      LEFT JOIN products p ON st.product_id = p.id
      WHERE st.user_id = ?
      ORDER BY st.created_at DESC
    `;
    const [rows] = await db.query(sql, [user_id]);
    return rows;
  },

  // INTI-nya: catat transaksi + update stok, atomic (barengan)
  processStockMovement: async (transactionData) => {
    const { product_id, user_id, type, quantity, notes } = transactionData;
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // Lock baris produk ini biar nggak ke-race sama transaksi lain yang jalan bersamaan
      const [productRows] = await connection.query(
        'SELECT stock_quantity FROM products WHERE id = ? FOR UPDATE',
        [product_id]
      );

      if (productRows.length === 0) {
        throw new Error('Produk tidak ditemukan');
      }

      const currentStock = productRows[0].stock_quantity;

      if (type === 'out' && currentStock < quantity) {
        throw new Error(`Stok tidak cukup. Sisa stok: ${currentStock}, diminta: ${quantity}`);
      }

      // 1. Insert record transaksi
      const insertSql = 'INSERT INTO stock_transactions (product_id, user_id, type, quantity, notes) VALUES (?, ?, ?, ?, ?)';
      const [result] = await connection.query(insertSql, [product_id, user_id, type, quantity, notes]);

      // 2. Update stok (nambah kalau 'in', kurang kalau 'out')
      const newStock = type === 'in' ? currentStock + quantity : currentStock - quantity;
      await connection.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [newStock, product_id]);

      await connection.commit();
      return { transactionId: result.insertId, newStock };

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  },
};

module.exports = stockTransactionModel;