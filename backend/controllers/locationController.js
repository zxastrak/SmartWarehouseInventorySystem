const locationModel = require('../models/locationModel');

const locationController = {
  create: async (req, res) => {
    try {
      const { location_code, zone } = req.body;

      if (!location_code) {
        return res.status(400).json({ message: 'Kode lokasi wajib diisi' });
      }

      const result = await locationModel.create({ location_code, zone });
      res.status(201).json({ message: 'Lokasi berhasil dibuat', locationId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const locations = await locationModel.getAll();
      res.status(200).json(locations);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const location = await locationModel.getById(id);

      if (location.length === 0) {
        return res.status(404).json({ message: 'Lokasi tidak ditemukan' });
      }

      res.status(200).json(location[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { location_code, zone } = req.body;

      const existing = await locationModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Lokasi tidak ditemukan' });
      }

      await locationModel.update(id, { location_code, zone });
      res.status(200).json({ message: 'Lokasi berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await locationModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Lokasi tidak ditemukan' });
      }

      await locationModel.remove(id);
      res.status(200).json({ message: 'Lokasi berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = locationController;