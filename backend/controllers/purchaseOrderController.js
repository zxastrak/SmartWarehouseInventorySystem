const purchaseOrderModel = require('../models/purchaseOrderModel');
const logAudit = require('../utils/audit');

const purchaseOrderController = {
  create: async (req, res) => {
    try {
      const { supplier_id, items } = req.body;
      const created_by = req.user.id;

      if (!supplier_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'supplier_id dan items (minimal 1) wajib diisi' });
      }

      for (const item of items) {
        if (!item.product_id) {
          return res.status(400).json({ message: 'Setiap item wajib punya product_id' });
        }
        if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
          return res.status(400).json({ message: 'Quantity item harus bilangan bulat positif' });
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          return res.status(400).json({ message: 'Price item harus berupa angka dan tidak boleh negatif' });
        }
      }

      const result = await purchaseOrderModel.create({
        supplier_id,
        created_by,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, price: i.price })),
      });

      await logAudit({
        user_id: created_by,
        action: 'PO_CREATED',
        table_affected: 'purchase_orders',
        record_id: result.poId,
      });

      res.status(201).json({ message: 'Purchase Order berhasil dibuat', poId: result.poId });
    } catch (err) {
      if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ message: 'supplier_id atau product_id tidak valid' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const orders = await purchaseOrderModel.getAll();
      res.status(200).json(orders);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const order = await purchaseOrderModel.getById(id);
      if (order.length === 0) {
        return res.status(404).json({ message: 'Purchase Order tidak ditemukan' });
      }

      const items = await purchaseOrderModel.getItemsByPoId(id);
      res.status(200).json({ ...order[0], items });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: "Status harus 'completed' atau 'cancelled'" });
      }

      const order = await purchaseOrderModel.getById(id);
      if (order.length === 0) {
        return res.status(404).json({ message: 'Purchase Order tidak ditemukan' });
      }
      if (order[0].status !== 'pending') {
        return res.status(400).json({ message: `PO sudah berstatus '${order[0].status}' dan tidak bisa diubah lagi` });
      }

      await purchaseOrderModel.updateStatus(id, status);

      await logAudit({
        user_id: req.user.id,
        action: status === 'completed' ? 'PO_COMPLETED' : 'PO_CANCELLED',
        table_affected: 'purchase_orders',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Status Purchase Order berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = purchaseOrderController;