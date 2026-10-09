const shiftModel = require('../models/shiftModel');
const userModel = require('../models/userModel');

const shiftController = {
  // Manager atur jadwal shift staf
  create: async (req, res) => {
    try {
      const { user_id, shift_date, start_time, end_time } = req.body;

      if (!user_id || !shift_date || !start_time || !end_time) {
        return res.status(400).json({ message: 'user_id, shift_date, start_time, dan end_time wajib diisi' });
      }

      const user = await userModel.findById(user_id);
      if (user.length === 0 || user[0].role !== 'staf') {
        return res.status(400).json({ message: 'user_id harus berupa akun staf yang terdaftar' });
      }

      const result = await shiftModel.create({ user_id, shift_date, start_time, end_time });
      res.status(201).json({ message: 'Shift berhasil dibuat', shiftId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const shifts = await shiftModel.getAll();
      res.status(200).json(shifts);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const shift = await shiftModel.getById(req.params.id);
      if (shift.length === 0) {
        return res.status(404).json({ message: 'Shift tidak ditemukan' });
      }
      res.status(200).json(shift[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Staf lihat jadwal shift-nya sendiri
  getMine: async (req, res) => {
    try {
      const sql_date = req.query.date; // opsional: /api/shifts/me?date=2026-09-30
      if (sql_date) {
        const shift = await shiftModel.getByUserAndDate(req.user.id, sql_date);
        return res.status(200).json(shift);
      }
      const shifts = await shiftModel.getAll();
      const mine = shifts.filter((s) => s.user_id === req.user.id);
      res.status(200).json(mine);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { user_id, shift_date, start_time, end_time } = req.body;

      const existing = await shiftModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Shift tidak ditemukan' });
      }

      await shiftModel.update(id, { user_id, shift_date, start_time, end_time });
      res.status(200).json({ message: 'Shift berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await shiftModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Shift tidak ditemukan' });
      }
      await shiftModel.remove(id);
      res.status(200).json({ message: 'Shift berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = shiftController;