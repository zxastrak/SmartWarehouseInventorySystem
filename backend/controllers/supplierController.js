const supplierModel = require('../models/supplierModel');

const supplierController = {
  create: async (req, res) => {
    try {
      const { name, contact_person, phone, address } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Nama supplier wajib diisi' });
      }

      const result = await supplierModel.create({ name, contact_person, phone, address });
      res.status(201).json({ message: 'Supplier berhasil dibuat', supplierId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const suppliers = await supplierModel.getAll();
      res.status(200).json(suppliers);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const supplier = await supplierModel.getById(id);

      if (supplier.length === 0) {
        return res.status(404).json({ message: 'Supplier tidak ditemukan' });
      }

      res.status(200).json(supplier[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, contact_person, phone, address } = req.body;

      const existing = await supplierModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Supplier tidak ditemukan' });
      }

      await supplierModel.update(id, { name, contact_person, phone, address });
      res.status(200).json({ message: 'Supplier berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await supplierModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Supplier tidak ditemukan' });
      }

      await supplierModel.remove(id);
      res.status(200).json({ message: 'Supplier berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = supplierController;