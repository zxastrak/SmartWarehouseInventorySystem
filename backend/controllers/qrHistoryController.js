const qrHistoryModel = require('../models/qrHistoryModel');

const qrHistoryController = {
  getAll: async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 100;
      const history = await qrHistoryModel.getAll(limit);
      res.status(200).json(history);
    } catch (err) {
      console.error('Error getAll qr-history:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { qr_type, type, code, name, action, details } = req.body;
      const resolvedType = qr_type || type || 'RACK';

      if (!code) {
        return res.status(400).json({ message: 'Kode / SKU wajib diisi' });
      }

      const validTypes = ['RACK', 'INBOUND_ITEM'];
      const normalizedType = validTypes.includes(resolvedType.toUpperCase())
        ? resolvedType.toUpperCase()
        : 'RACK';

      const validActions = ['GENERATE', 'PRINT', 'DOWNLOAD'];
      const normalizedAction = validActions.includes((action || '').toUpperCase())
        ? action.toUpperCase()
        : 'GENERATE';

      const userId = req.user?.id || null;

      const insertId = await qrHistoryModel.create({
        user_id: userId,
        qr_type: normalizedType,
        code: String(code).trim().toUpperCase(),
        name: name || (normalizedType === 'RACK' ? `Lokasi Rak ${code}` : `Barang ${code}`),
        action: normalizedAction,
        details: details || {},
      });

      res.status(201).json({
        id: insertId,
        message: 'Riwayat QR berhasil dicatat ke database',
      });
    } catch (err) {
      console.error('Error create qr-history:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const affected = await qrHistoryModel.deleteById(id);
      if (affected === 0) {
        return res.status(404).json({ message: 'Riwayat QR tidak ditemukan' });
      }
      res.status(200).json({ message: 'Riwayat QR berhasil dihapus' });
    } catch (err) {
      console.error('Error delete qr-history:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  clearAll: async (req, res) => {
    try {
      await qrHistoryModel.clearAll();
      res.status(200).json({ message: 'Seluruh riwayat QR di database berhasil dikosongkan' });
    } catch (err) {
      console.error('Error clearAll qr-history:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = qrHistoryController;
