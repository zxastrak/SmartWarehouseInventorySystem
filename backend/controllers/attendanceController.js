const attendanceModel = require('../models/attendanceModel');

const attendanceController = {
  checkIn: async (req, res) => {
    try {
      const last = await attendanceModel.getLastByUserId(req.user.id);
      if (last.length > 0 && last[0].type === 'check_in') {
        return res.status(400).json({ message: 'Anda sudah check-in, silakan check-out terlebih dahulu' });
      }

      const result = await attendanceModel.checkIn(req.user.id);
      res.status(201).json({ message: 'Check-in berhasil', attendanceId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  checkOut: async (req, res) => {
    try {
      const last = await attendanceModel.getLastByUserId(req.user.id);
      if (last.length === 0 || last[0].type === 'check_out') {
        return res.status(400).json({ message: 'Anda belum check-in' });
      }

      const result = await attendanceModel.checkOut(req.user.id);
      res.status(201).json({ message: 'Check-out berhasil', attendanceId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Riwayat absensi milik staf yang login
  getMine: async (req, res) => {
    try {
      const logs = await attendanceModel.getByUserId(req.user.id);
      res.status(200).json(logs);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Manager: rekap absensi semua staf
  getAll: async (req, res) => {
    try {
      const logs = await attendanceModel.getAll();
      res.status(200).json(logs);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = attendanceController;