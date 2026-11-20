/**
 * Warehouse CRUD Controller
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');

const warehouseController = {
  create: async (req, res) => {
    try {
      const { code, name, width_mm, length_mm, height_mm } = req.body;
      if (!code || !name || !width_mm || !length_mm || !height_mm) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Seluruh atribut gudang (code, name, width_mm, length_mm, height_mm) wajib diisi.',
          requestId: req.requestId,
        });
      }

      const [existing] = await db.query('SELECT id FROM warehouses WHERE code = ?', [code]);
      if (existing.length > 0) {
        return res.status(409).json({
          error: 'DUPLICATE_CODE',
          message: `Warehouse dengan kode '${code}' sudah terdaftar.`,
          requestId: req.requestId,
        });
      }

      const [result] = await db.query(
        `INSERT INTO warehouses (code, name, width_mm, length_mm, height_mm, layout_version)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [code.trim().toUpperCase(), name.trim(), width_mm, length_mm, height_mm]
      );

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'WAREHOUSE_CREATED',
        table_affected: 'warehouses',
        record_id: result.insertId,
      });

      res.status(201).json({
        message: 'Gudang berhasil dibuat',
        warehouseId: result.insertId,
        requestId: req.requestId,
      });
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
  },

  getAll: async (req, res) => {
    try {
      const [rows] = await db.query('SELECT * FROM warehouses ORDER BY id ASC');
      res.status(200).json({ data: rows, requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [rows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Warehouse tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      res.status(200).json({ data: rows[0], requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { name, width_mm, length_mm, height_mm } = req.body;

      const updates = [];
      const values = [];

      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Nama gudang tidak boleh kosong.',
            requestId: req.requestId,
          });
        }
        updates.push('name = ?');
        values.push(name.trim());
      }

      if (width_mm !== undefined) {
        const w = Number(width_mm);
        if (isNaN(w) || w <= 0) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Panjang gudang (width_mm) harus angka positif.',
            requestId: req.requestId,
          });
        }
        updates.push('width_mm = ?');
        values.push(w);
      }

      if (length_mm !== undefined) {
        const l = Number(length_mm);
        if (isNaN(l) || l <= 0) {
          return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Lebar gudang (length_mm) harus angka positif.',
            requestId: req.requestId,
          });
        }
        updates.push('length_mm = ?');
        values.push(l);
      }

      if (height_mm !== undefined) {
        const h = Number(height_mm);
        if (!isNaN(h) && h > 0) {
          updates.push('height_mm = ?');
          values.push(h);
        }
      }

      if (updates.length === 0) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Tidak ada data atribut yang dikirim untuk diperbarui.',
          requestId: req.requestId,
        });
      }

      updates.push('layout_version = layout_version + 1');
      updates.push('updated_at = NOW()');
      values.push(id);

      const [result] = await db.query(
        `UPDATE warehouses SET ${updates.join(', ')} WHERE id = ?`,
        values
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Warehouse tidak ditemukan.',
          requestId: req.requestId,
        });
      }

      const [updatedRows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [id]);

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'WAREHOUSE_UPDATED',
        table_affected: 'warehouses',
        record_id: Number(id),
      });

      res.status(200).json({
        message: 'Data gudang berhasil diperbarui.',
        data: updatedRows[0],
        requestId: req.requestId,
      });
    } catch (err) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: err.message,
        requestId: req.requestId,
      });
    }
  },
};

module.exports = warehouseController;
