const purchaseOrderModel = require('../models/purchaseOrderModel');
const logAudit = require('../utils/audit');

const purchaseOrderController = {
  create: async (req, res) => {
    try {
      const {
        po_number,
        supplier_id,
        expected_date,
        payment_terms,
        reference,
        notes,
        deliver_to,
        total_amount,
        status = 'pending',
        items,
      } = req.body;
      const created_by = req.user?.id || null;

      if (!supplier_id || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'supplier_id dan items (minimal 1) wajib diisi' });
      }

      for (const item of items) {
        if (!item.product_id) {
          return res.status(400).json({ message: 'Setiap item wajib punya product_id' });
        }
        if (!Number.isInteger(Number(item.quantity)) || Number(item.quantity) <= 0) {
          return res.status(400).json({ message: 'Quantity item harus bilangan bulat positif' });
        }
        if (typeof Number(item.price) !== 'number' || Number(item.price) < 0) {
          return res.status(400).json({ message: 'Price item harus berupa angka dan tidak boleh negatif' });
        }
      }

      const result = await purchaseOrderModel.create({
        po_number,
        supplier_id,
        created_by,
        expected_date,
        payment_terms,
        reference,
        notes,
        deliver_to,
        total_amount,
        status,
        items: items.map((i) => ({
          product_id: i.product_id,
          quantity: Number(i.quantity),
          price: Number(i.price),
        })),
      });

      await logAudit({
        user_id: created_by,
        action: 'PO_CREATED',
        table_affected: 'purchase_orders',
        record_id: result.poId,
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Purchase Order berhasil dibuat',
        poId: result.poId,
        id: result.poId,
        po_number: result.po_number,
      });
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
      res.status(500).json({ message: 'Gagal mengambil data purchase orders', error: err.message });
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

      if (!status) {
        return res.status(400).json({ message: 'Status wajib diisi' });
      }

      const order = await purchaseOrderModel.getById(id);
      if (order.length === 0) {
        return res.status(404).json({ message: 'Purchase Order tidak ditemukan' });
      }

      await purchaseOrderModel.updateStatus(id, status, req.user?.id);

      await logAudit({
        user_id: req.user?.id,
        action: `PO_${status.toUpperCase().replace(/\s+/g, '_')}`,
        table_affected: 'purchase_orders',
        record_id: Number(id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: `Status Purchase Order berhasil diupdate menjadi '${status}'` });
    } catch (err) {
      res.status(500).json({ message: 'Gagal mengupdate status PO', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await purchaseOrderModel.update(id, data);
      res.status(200).json({ success: true, message: 'Purchase Order berhasil diperbarui', affectedRows: result.affectedRows });
    } catch (err) {
      res.status(500).json({ message: 'Gagal memperbarui PO', error: err.message });
    }
  },
};

module.exports = purchaseOrderController;