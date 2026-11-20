/**
 * Aisle CRUD Controller with Collision & Access Rules
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');
const LayoutValidationService = require('../services/layoutValidationService');

const aisleController = {
  create: async (req, res) => {
    try {
      const { warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm, direction } = req.body;

      if (!warehouse_id || !aisle_code || !name || width_mm == null || length_mm == null) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'warehouse_id, aisle_code, name, width_mm, dan length_mm wajib diisi.',
          requestId: req.requestId,
        });
      }

      // Validasi lebar minimum lorong (1500 mm)
      if (width_mm < 1500) {
        return res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: `Lebar lorong (${width_mm} mm) kurang dari batas minimum 1500 mm.`,
          requestId: req.requestId,
        });
      }

      const [whRows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [warehouse_id]);
      if (whRows.length === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Warehouse tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      const warehouse = whRows[0];

      // 1. Validasi batas dalam gudang
      const boundCheck = LayoutValidationService.validateWarehouseBoundary(
        { x_mm: x_mm || 0, y_mm: y_mm || 0, length_mm: width_mm, depth_mm: length_mm, rotation: 0 },
        warehouse
      );
      if (!boundCheck.valid) {
        return res.status(422).json({
          error: boundCheck.conflict.code,
          ...boundCheck.conflict,
          requestId: req.requestId,
        });
      }

      // 2. Validasi tabrakan fisik dengan rak dan rintangan
      const conn = await db.getConnection();
      try {
        const colCheck = await LayoutValidationService.validatePhysicalCollisions(
          conn,
          warehouse_id,
          'aisle',
          { x_mm: x_mm || 0, y_mm: y_mm || 0, length_mm: width_mm, depth_mm: length_mm, rotation: 0 }
        );

        if (!colCheck.valid) {
          return res.status(409).json({
            error: colCheck.conflict.code,
            ...colCheck.conflict,
            requestId: req.requestId,
          });
        }

        const normalizedCode = aisle_code.trim().toUpperCase();
        const [result] = await conn.query(
          `INSERT INTO aisles (warehouse_id, aisle_code, name, x_mm, y_mm, width_mm, length_mm, direction)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            warehouse_id,
            normalizedCode,
            name.trim(),
            x_mm || 0,
            y_mm || 0,
            width_mm,
            length_mm,
            direction || 'two_way',
          ]
        );

        await conn.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [warehouse_id]);

        await logAudit({
          user_id: req.user?.id || 1,
          action: 'AISLE_CREATED',
          table_affected: 'aisles',
          record_id: result.insertId,
        });

        res.status(201).json({
          message: 'Lorong berhasil dibuat',
          aisleId: result.insertId,
          requestId: req.requestId,
        });
      } finally {
        conn.release();
      }
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'DUPLICATE_CODE',
          message: 'Kode lorong sudah terdaftar pada gudang ini.',
          requestId: req.requestId,
        });
      }
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  getByWarehouse: async (req, res) => {
    try {
      const { warehouseId } = req.params;
      const [rows] = await db.query(
        'SELECT * FROM aisles WHERE warehouse_id = ? AND retired_at IS NULL ORDER BY id ASC',
        [warehouseId]
      );
      res.status(200).json({ data: rows, requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  retire: async (req, res) => {
    try {
      const { id } = req.params;

      // AC-28 & SPEC 5.6: Aisle yang masih menjadi akses rak aktif dilarang di-retire / dihapus!
      const [referencingRacks] = await db.query(
        `SELECT r.id, r.rack_code
         FROM rack_aisle_access raa
         JOIN racks r ON raa.rack_id = r.id
         WHERE raa.aisle_id = ? AND r.retired_at IS NULL`,
        [id]
      );

      if (referencingRacks.length > 0) {
        return res.status(409).json({
          error: 'RELATION_CONFLICT',
          message: `Lorong tidak dapat dinonaktifkan/dihapus karena masih menjadi akses untuk ${referencingRacks.length} rak aktif (AC-28).`,
          referencingRacks,
          requestId: req.requestId,
        });
      }

      const [aisleRows] = await db.query('SELECT warehouse_id FROM aisles WHERE id = ?', [id]);
      await db.query('UPDATE aisles SET retired_at = NOW() WHERE id = ?', [id]);
      if (aisleRows.length > 0) {
        await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [aisleRows[0].warehouse_id]);
      }
      await logAudit({
        user_id: req.user?.id || 1,
        action: 'AISLE_RETIRED',
        table_affected: 'aisles',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Lorong berhasil di-retire', requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },
};

module.exports = aisleController;
