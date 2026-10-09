const productModel = require('../models/productModel');

const productController = {
  create: async (req, res) => {
    try {
      const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id } = req.body;

      if (!name || !sku) {
        return res.status(400).json({ message: 'Nama dan SKU produk wajib diisi' });
      }

      const result = await productModel.create({
        name, sku, category_id, supplier_id,
        stock_quantity: stock_quantity || 0,
        unit: unit || 'pcs',
        price: price || 0,
        location_id,
      });

      res.status(201).json({ message: 'Produk berhasil dibuat', productId: result.insertId });
    } catch (err) {
      // Kode error khusus kalau SKU-nya udah dipake (kolom sku itu UNIQUE)
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'SKU sudah terdaftar' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getAll: async (req, res) => {
    try {
      const products = await productModel.getAll();
      res.status(200).json(products);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const product = await productModel.getById(id);

      if (product.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      res.status(200).json(product[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Endpoint khusus buat Staf scan barcode (Skenario A & B di dokumen SIMS)
  findBySku: async (req, res) => {
    try {
      const { sku } = req.params;
      const product = await productModel.findBySku(sku);

      if (product.length === 0) {
        return res.status(404).json({ message: 'SKU tidak ditemukan / belum terdaftar' });
      }

      res.status(200).json(product[0]);
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id } = req.body;

      const existing = await productModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      await productModel.update(id, { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id });
      res.status(200).json({ message: 'Produk berhasil diupdate' });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'SKU sudah terdaftar' });
      }
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;

      const existing = await productModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      await productModel.remove(id);
      res.status(200).json({ message: 'Produk berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = productController;