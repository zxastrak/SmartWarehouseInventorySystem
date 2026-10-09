const db = require('../config/db');

const purchaseOrderModel = {
    create: async (poData) => {
        const { supplier_id, created_by, items } = poData; // items = [{ product_id, quantity, unit_price }]
        const connection = await db.getConnection();

        try {
            await connection.beginTransaction();

            const insertPoSql = "INSERT INTO purchase_orders (supplier_id, created_by, status) VALUES (?, ?, 'pending')";
            const [poResult] = await connection.query(insertPoSql, [supplier_id, created_by]);

            const insertItemSql = 'INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)';
            for (const item of items) {
                await connection.query(insertItemSql, [poResult.insertId, item.product_id, item.quantity, item.price]);
            }

            await connection.commit();
            return { poId: poResult.insertId };

        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
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