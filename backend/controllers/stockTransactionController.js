const stockTransactionModel = require('../models/stockTransactionModel');

const stockTransactionController = {
  // Staf catat SKU IN / SKU OUT
  create: async (req, res) => {
    try {
      const { product_id, type, quantity, notes } = req.body;
      const user_id = req.user.id; // dari JWT, bukan dari body

      if (!product_id || !type || quantity === undefined) {
        return res.status(400).json({ message: 'product_id, type, dan quantity wajib diisi' });
      }

      if (!['in', 'out'].includes(type)) {
        return res.status(400).json({ message: "Type harus 'in' atau 'out'" });
      }

      if (!Number.isInteger(quantity) || quantity <= 0) {
        return res.status(400).json({ message: 'Quantity harus bilangan bulat positif' });
      }

      const result = await stockTransactionModel.processStockMovement({
        product_id, user_id, type, quantity, notes,
      });

      res.status(201).json({
        message: 'Transaksi berhasil dicatat',
        transactionId: result.transactionId,
        newStock: result.newStock,
      });
    } catch (err) {
      if (err.message === 'Produk tidak ditemukan') {
        return res.status(404).json({ message: err.message });
      }
      if (err.message.startsWith('Stok tidak cukup')) {
        return res.status(400).json({ message: err.message });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Manager: lihat semua transaksi
  getAll: async (req, res) => {
    try {
      const transactions = await stockTransactionModel.getAll();
      res.status(200).json(transactions);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Riwayat transaksi milik user yang lagi login (fitur "Riwayat Transaksi Harian Staf")
  getMine: async (req, res) => {
    try {
      const transactions = await stockTransactionModel.getByUserId(req.user.id);
      res.status(200).json(transactions);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Riwayat pergerakan satu produk
  getByProduct: async (req, res) => {
    try {
      const { product_id } = req.params;
      const transactions = await stockTransactionModel.getByProductId(product_id);
      res.status(200).json(transactions);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = stockTransactionController;