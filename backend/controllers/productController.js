const productModel = require('../models/productModel');
const stockTransactionModel = require('../models/stockTransactionModel');
const logAudit = require('../utils/audit');

const productController = {
  create: async (req, res) => {
    try {
      const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id, image_url, description } = req.body;

      if (!name || !sku) {
        return res.status(400).json({ message: 'Nama dan SKU produk wajib diisi' });
      }

      const result = await productModel.create({
        name,
        sku,
        category_id,
        supplier_id,
        stock_quantity: stock_quantity || 0,
        unit: unit || 'pcs',
        price: price || 0,
        location_id,
        image_url: image_url || null,
        description: description || null,
      });

      await logAudit({
        user_id: req.user.id,
        action: 'PRODUCT_CREATED',
        table_affected: 'products',
        record_id: result.insertId,
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

  // Relokasi rak / Putaway oleh staf atau manajer
  updateLocation: async (req, res) => {
    try {
      const { id } = req.params;
      const { location } = req.body || {};

      if (!location || typeof location !== 'string' || location.trim().length === 0) {
        return res.status(400).json({ message: 'Lokasi rak tujuan wajib diisi' });
      }

      const products = await productModel.getById(id);
      if (products.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      const targetLoc = location.trim().toUpperCase();
      await productModel.updateLocation(id, targetLoc);

      await logAudit({
        user_id: req.user.id,
        action: 'PUTAWAY_RELOCATION',
        table_affected: 'products',
        record_id: Number(id),
      });

      res.status(200).json({
        message: 'Lokasi rak berhasil diperbarui (Putaway sukses)',
        zone_location: targetLoc,
      });
    } catch (err) {
      console.error('[ERROR updateLocation]', err);
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },

  // Penyesuaian stok opname / verifikasi fisik di rak
  adjustStock: async (req, res) => {
    try {
      const { id } = req.params;
      const { physical_quantity, notes } = req.body || {};

      if (physical_quantity === undefined || physical_quantity === null || isNaN(Number(physical_quantity)) || Number(physical_quantity) < 0) {
        return res.status(400).json({ message: 'Jumlah fisik valid wajib diisi (minimal 0)' });
      }

      const products = await productModel.getById(id);
      if (products.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      const currentStock = products[0].stock_quantity;
      const newStock = Number(physical_quantity);
      const diff = newStock - currentStock;

      if (diff !== 0) {
        const type = diff > 0 ? 'in' : 'out';
        const qty = Math.abs(diff);
        const note = notes ? notes.trim() : `Penyesuaian stok opname rak (Sistem: ${currentStock} -> Fisik: ${newStock})`;

        await stockTransactionModel.processStockMovement({
          product_id: Number(id),
          user_id: req.user.id,
          type: type,
          quantity: qty,
          notes: note,
        });
      }

      await logAudit({
        user_id: req.user.id,
        action: 'RACK_STOCK_VERIFIED',
        table_affected: 'products',
        record_id: Number(id),
      });

      const updated = await productModel.getById(id);
      res.status(200).json({
        message: 'Stok fisik rak berhasil diverifikasi',
        stock_quantity: updated[0] ? updated[0].stock_quantity : newStock,
      });
    } catch (err) {
      console.error('[ERROR adjustStock]', err);
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
      const { name, sku, category_id, supplier_id, stock_quantity, unit, price, location_id, image_url, description } = req.body;

      const existing = await productModel.getById(id);
      if (existing.length === 0) {
        return res.status(404).json({ message: 'Produk tidak ditemukan' });
      }

      const current = existing[0];
      await productModel.update(id, {
        name: name !== undefined ? name : current.name,
        sku: sku !== undefined ? sku : current.sku,
        category_id: category_id !== undefined ? category_id : current.category_id,
        supplier_id: supplier_id !== undefined ? supplier_id : current.supplier_id,
        stock_quantity: stock_quantity !== undefined ? stock_quantity : current.stock_quantity,
        unit: unit !== undefined ? unit : current.unit,
        price: price !== undefined ? price : current.price,
        location_id: location_id !== undefined ? location_id : current.location_id,
        image_url: image_url !== undefined ? image_url : current.image_url,
        description: description !== undefined ? description : current.description,
      });

      await logAudit({
        user_id: req.user.id,
        action: 'PRODUCT_UPDATED',
        table_affected: 'products',
        record_id: Number(id),
      });

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

      await logAudit({
        user_id: req.user.id,
        action: 'PRODUCT_DELETED',
        table_affected: 'products',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Produk berhasil dihapus' });
    } catch (err) {
      res.status(500).json({ message: 'Terjadi kesalahan server', error: err.message });
    }
  },
};

module.exports = productController;