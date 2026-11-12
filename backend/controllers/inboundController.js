const inboundModel = require('../models/inboundModel');
const logAudit = require('../utils/audit');

const inboundController = {
  getAll: async (req, res) => {
    try {
      const rows = await inboundModel.getAll();
      res.status(200).json(rows);
    } catch (err) {
      console.error('Inbound getAll error:', err);
      res.status(500).json({ message: 'Gagal mengambil data inbound', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const rows = await inboundModel.getById(id);
      if (rows.length === 0) {
        return res.status(404).json({ message: 'Inbound shipment tidak ditemukan' });
      }
      const shipment = rows[0];
      const items = await inboundModel.getItemsByInboundId(shipment.id);
      res.status(200).json({ ...shipment, items });
    } catch (err) {
      console.error('Inbound getById error:', err);
      res.status(500).json({ message: 'Gagal mengambil detail inbound', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const data = req.body;
      const createdBy = req.user?.id || null;
      const result = await inboundModel.create({
        ...data,
        scheduled_by: createdBy,
      });

      await logAudit({
        user_id: createdBy,
        action: 'INBOUND_CREATED',
        table_affected: 'inbound_shipments',
        record_id: result.shipmentId,
      }).catch(() => {});

      res.status(201).json({
        success: true,
        message: 'Inbound shipment berhasil dijadwalkan',
        data: { shipmentId: result.shipmentId },
      });
    } catch (err) {
      console.error('Inbound create error:', err);
      res.status(500).json({ message: 'Gagal membuat inbound shipment', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const result = await inboundModel.update(id, data);
      res.status(200).json({ success: true, message: 'Jadwal inbound berhasil diperbarui', affectedRows: result.affectedRows });
    } catch (err) {
      console.error('Inbound update error:', err);
      res.status(500).json({ message: 'Gagal memperbarui inbound', error: err.message });
    }
  },

  updateStatus: async (req, res) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body;
      const userId = req.user?.id || null;

      if (!status) {
        return res.status(400).json({ message: 'Status wajib diisi' });
      }

      await inboundModel.updateStatus(id, status, notes, userId);

      await logAudit({
        user_id: userId,
        action: `INBOUND_${status.toUpperCase()}`,
        table_affected: 'inbound_shipments',
        record_id: isNaN(Number(id)) ? null : Number(id),
      }).catch(() => {});

      res.status(200).json({ success: true, message: `Status inbound diperbarui menjadi ${status}` });
    } catch (err) {
      console.error('Inbound updateStatus error:', err);
      res.status(500).json({ message: 'Gagal mengubah status inbound', error: err.message });
    }
  },

  inspect: async (req, res) => {
    try {
      const { id } = req.params;
      const { notes, evidence_url, items, inspector, status } = req.body || {};

      const result = await inboundModel.inspect(id, {
        notes,
        evidence_url,
        items,
        status: status || 'Inspected',
        inspector: inspector || req.user?.fullName || req.user?.name || req.user?.username || null,
      });

      await logAudit({
        user_id: req.user?.id,
        action: `INBOUND_${(status || 'INSPECTED').toUpperCase()}`,
        table_affected: 'inbound_shipments',
        record_id: result.shipmentId || (isNaN(Number(id)) ? null : Number(id)),
      }).catch(() => {});

      res.status(200).json({
        success: true,
        message: 'Hasil pemeriksaan inbound berhasil dikirim ke Manager untuk Review & ACC',
        data: result,
      });
    } catch (err) {
      console.error('Inbound inspect error:', err);
      res.status(500).json({ message: 'Gagal memulai inspeksi inbound', error: err.message });
    }
  },

  completeReceiving: async (req, res) => {
    try {
      const { id } = req.params;
      const { items, notes } = req.body;
      const userId = req.user?.id || null;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ message: 'Item penerimaan wajib disertakan' });
      }

      const result = await inboundModel.completeReceiving(id, items, notes, userId);

      await logAudit({
        user_id: userId,
        action: 'INBOUND_RECEIVED',
        table_affected: 'inbound_shipments',
        record_id: isNaN(Number(id)) ? null : Number(id),
      }).catch(() => {});

      res.status(200).json({
        success: true,
        message: 'Penerimaan barang (Receiving) berhasil diselesaikan dan stok bertambah',
        acceptedUnits: result.acceptedUnits,
      });
    } catch (err) {
      console.error('Inbound completeReceiving error:', err);
      res.status(500).json({ message: 'Gagal menyelesaikan penerimaan barang', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      await inboundModel.delete(id);
      res.status(200).json({ success: true, message: 'Inbound shipment berhasil dihapus' });
    } catch (err) {
      console.error('Inbound delete error:', err);
      res.status(500).json({ message: 'Gagal menghapus inbound shipment', error: err.message });
    }
  },
};

module.exports = inboundController;
