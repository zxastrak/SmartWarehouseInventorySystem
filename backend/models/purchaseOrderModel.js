const db = require('../config/db');

const purchaseOrderModel = {
    create: async (poData) => {
        const { supplier_id, created_by, items } = poData; // items = [{ product_id, quantity, price }]
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const insertPoSql = "INSERT INTO purchase_orders (supplier_id, created_by, status) VALUES (?, ?, 'pending')";
            const [poResult] = await connection.query(insertPoSql, [supplier_id, created_by]);

            const values = items.map((item) => [poResult.insertId, item.product_id, item.quantity, item.price]);
            const insertItemsSql = 'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, price) VALUES ?';
            await connection.query(insertItemsSql, [values]);

            await connection.commit();
            return { poId: poResult.insertId };

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    },

    getById: async (id) => {
        const sql = 'SELECT * FROM purchase_orders WHERE id = ?';
        const [rows] = await db.query(sql, [id]);
        return rows;
    },

    getAll: async () => {
        const sql = 'SELECT * FROM purchase_orders ORDER BY created_at DESC';
        const [rows] = await db.query(sql);
        return rows;
    },

    getItemsByPoId: async (po_id) => {
        const sql = 'SELECT * FROM purchase_order_items WHERE purchase_order_id = ?';
        const [rows] = await db.query(sql, [po_id]);
        return rows;
    },

    updateStatus: async (id, status) => {
        const sql = 'UPDATE purchase_orders SET status = ? WHERE id = ?';
        const [result] = await db.query(sql, [status, id]);
        return result;
    },
};

module.exports = purchaseOrderModel;