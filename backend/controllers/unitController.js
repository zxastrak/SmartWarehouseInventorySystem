const unitModel = require('../models/unitModel');

const unitController = {
  getAll: async (req, res) => {
    try {
      const units = await unitModel.getAll();
      res.status(200).json(units);
    } catch (err) {
      console.error('Error getAll units:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  create: async (req, res) => {
    try {
      const { name, label, description, default_weight_kg } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Nama satuan / kemasan wajib diisi' });
      }

      const existing = await unitModel.getByName(name);
      if (existing) {
        return res.status(400).json({ message: `Satuan "${name.trim()}" sudah ada di database.` });
      }

      const insertId = await unitModel.create({
        name: name.trim(),
        label: label ? label.trim() : name.trim(),
        description: description ? description.trim() : '',
        default_weight_kg: default_weight_kg ? Number(default_weight_kg) : null,
      });

      const newUnit = await unitModel.getById(insertId);
      res.status(201).json({
        message: 'Satuan kemasan berhasil ditambahkan',
        unitId: insertId,
        unit: newUnit,
      });
    } catch (err) {
      console.error('Error create unit:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, label, description, default_weight_kg } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ message: 'Nama satuan wajib diisi' });
      }

      const existing = await unitModel.getById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Satuan tidak ditemukan' });
      }

      await unitModel.update(id, {
        name: name.trim(),
        label: label ? label.trim() : name.trim(),
        description: description ? description.trim() : '',
        default_weight_kg: default_weight_kg ? Number(default_weight_kg) : null,
      });

      const updated = await unitModel.getById(id);
      res.status(200).json({
        message: 'Satuan berhasil diperbarui',
        unit: updated,
      });
    } catch (err) {
      console.error('Error update unit:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  delete: async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await unitModel.getById(id);
      if (!existing) {
        return res.status(404).json({ message: 'Satuan tidak ditemukan' });
      }

      await unitModel.delete(id);
      res.status(200).json({ message: `Satuan "${existing.label || existing.name}" berhasil dihapus` });
    } catch (err) {
      console.error('Error delete unit:', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = unitController;
