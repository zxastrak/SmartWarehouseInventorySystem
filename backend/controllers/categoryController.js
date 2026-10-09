const categoryModel = require('../models/categoryModel');

const categoryController = {
  create: async (req, res) => {
    try {
      const { name, description } = req.body;

      if (!name) {
        return res.status(400).json({ message: 'Nama kategori wajib diisi' });
      }

      const result = await categoryModel.create({ name, description });
      res.status(201).json({ message: 'Kategori berhasil dibuat', categoryId: result.insertId });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const categories = await categoryModel.getAll();
      res.status(200).json(categories);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const category = await categoryModel.getById(id);

      if (category.length === 0) {
        return res.status(404).json({ message: 'Kategori tidak ditemukan' });
      }

      res.status(200).json(category[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, description } = req.body;

      const existing = await categoryModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Kategori tidak ditemukan' });
      }

      await categoryModel.update(id, { name, description });
      res.status(200).json({ message: 'Kategori berhasil diupdate' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await categoryModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Kategori tidak ditemukan' });
      }

      await categoryModel.remove(id);
      res.status(200).json({ message: 'Kategori berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = categoryController;