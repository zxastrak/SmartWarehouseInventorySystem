const outboundModel = require('../models/outboundModel');
const logAudit = require('../utils/audit');

const outboundController = {
  getAll: async (req, res) => {
    try {
      const rows = await outboundModel.getAll();
      res.status(200).json(rows);
    } catch (err) {
      console.error('Outbound getAll error:', err);
      res.status(500).json({ message: 'Gagal mengambil data outbound', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await outboundModel.getById(id);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Outbound shipment tidak ditemukan' });
      }
      res.status(200).json(rows[0]);
    } catch (err) {
      console.error('Outbound getById error:', err);
      res.status(500).json({ message: 'Gagal mengambil detail outbound', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body;
      const createdBy = req.user?.id || null;
      const result = await outboundModel.create({
        ...data,
        created_by: createdBy,
      });

      await logAudit({
        user_id: createdBy,
        action: 'OUTBOUND_CREATED',
        table_affected: 'outbound_shipments',
        record_id: result.shipmentId,
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Outbound shipment berhasil dibuat',
        data: { shipmentId: result.shipmentId },
      });
    } catch (err) {
      console.error('Outbound create error:', err);
      res.status(500).json({ message: 'Gagal membuat outbound shipment', error: err.message });
    }
  },

  inspect: async (req, res) => {
    try {
      const { id } = req.params;
      const { notes, evidence_url, items, inspector, status } = req.body || {};
      const staffName = inspector || req.user?.name || 'Staf Lapangan';

      const result = await outboundModel.inspect(id, {
        notes,
        evidence_url,
        items,
        inspector: staffName,
        status: status || 'Inspected',
      });

      await logAudit({
        user_id: req.user?.id || null,
        action: 'OUTBOUND_INSPECTED',
        table_affected: 'outbound_shipments',
        record_id: isNaN(Number(id)) ? null : Number(id),
      }).catch(() => {});

      res.status(200).json({
        success: true,
        message: 'Hasil pemeriksaan & scan barcode outbound berhasil disimpan',
        data: result,
      });
    } catch (err) {
      console.error('Outbound inspect error:', err);
      res.status(500).json({ message: 'Gagal menyimpan pemeriksaan outbound', error: err.message });
    }
  },

  dispatch: async (req, res) => {
    try {
      const { id } = req.params;
      const { carrier, tracking_number, items, notes } = req.body || {};
      const userId = req.user?.id || null;

      const result = await outboundModel.dispatchShipment(id, {
        carrier,
        tracking_number,
        items,
        notes,
        user_id: userId,
      });

      await logAudit({
        user_id: userId,
        action: 'OUTBOUND_SHIPPED',
        table_affected: 'outbound_shipments',
        record_id: isNaN(Number(id)) ? result.shipmentId : Number(id),
      }).catch(() => {});

      res.status(200).json({
        success: true,
        message: 'Outbound berhasil di-ACC / dikirim dan stok master telah dipotong',
        data: result,
      });
    } catch (err) {
      console.error('Outbound dispatch error:', err);
      res.status(500).json({ message: 'Gagal memproses pengiriman outbound', error: err.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, carrier, tracking, notes } = req.body || {};

      if (!status) {
        return res.status(400).json({ message: 'Status wajib diisi' });
      }

      await outboundModel.updateStatus(id, status, {
        carrier,
        tracking,
        notes,
        userId: req.user?.id,
      });

      await logAudit({
        user_id: req.user?.id,
        action: `OUTBOUND_${status.toUpperCase()}`,
        table_affected: 'outbound_shipments',
        record_id: isNaN(Number(id)) ? null : Number(id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: `Status outbound diperbarui menjadi ${status}` });
    } catch (err) {
      console.error('Outbound updateStatus error:', err);
      res.status(500).json({ message: 'Gagal mengubah status outbound', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await outboundModel.getById(id);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Outbound shipment tidak ditemukan' });
      }
      if (rows[0].status === 'Shipped') {
        return res.status(400).json({ message: 'Outbound yang sudah Shipped tidak dapat dihapus' });
      }

      await outboundModel.delete(id);

      await logAudit({
        user_id: req.user?.id,
        action: 'OUTBOUND_DELETED',
        table_affected: 'outbound_shipments',
        record_id: isNaN(Number(id)) ? null : Number(id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: 'Outbound shipment berhasil dihapus' });
    } catch (err) {
      console.error('Outbound delete error:', err);
      res.status(500).json({ message: 'Gagal menghapus outbound shipment', error: err.message });
    }
  },
};

module.exports = outboundController;
