/**
 * Zone CRUD Controller with Geometry Validation
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');
const LayoutValidationService = require('../services/layoutValidationService');

const zoneController = {
  create: async (req, res) => {
    try {
      const { warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm } = req.body;

      if (!warehouse_id || !zone_code || !name || width_mm == null || length_mm == null) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'warehouse_id, zone_code, name, width_mm, dan length_mm wajib diisi.',
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

      // 2. Validasi no-overlap dengan zona lain
      const [existingZones] = await db.query('SELECT * FROM zones WHERE warehouse_id = ?', [warehouse_id]);
      const overlapCheck = LayoutValidationService.validateNoZoneOverlap(
        { x_mm: x_mm || 0, y_mm: y_mm || 0, width_mm, length_mm, zone_code },
        existingZones
      );
      if (!overlapCheck.valid) {
        return res.status(409).json({
          error: overlapCheck.conflict.code,
          ...overlapCheck.conflict,
          requestId: req.requestId,
        });
      }

      const normalizedCode = zone_code.trim().toUpperCase();
      const [result] = await db.query(
        `INSERT INTO zones (warehouse_id, zone_code, name, color_hex, x_mm, y_mm, width_mm, length_mm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [warehouse_id, normalizedCode, name.trim(), color_hex || '#5c732b', x_mm || 0, y_mm || 0, width_mm, length_mm]
      );

      await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [warehouse_id]);

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'ZONE_CREATED',
        table_affected: 'zones',
        record_id: result.insertId,
      });

      res.status(201).json({
        message: 'Zona berhasil dibuat',
        zoneId: result.insertId,
        requestId: req.requestId,
      });
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          error: 'DUPLICATE_CODE',
          message: 'Kode zona sudah terdaftar pada gudang ini.',
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
        'SELECT * FROM zones WHERE warehouse_id = ? ORDER BY id ASC',
        [warehouseId]
      );
      res.status(200).json({ data: rows, requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  remove: async (req, res) => {
    try {
      const { id } = req.params;
      // Cek apakah ada rak aktif di zona ini (AC-28)
      const [activeRacks] = await db.query(
        'SELECT id, rack_code FROM racks WHERE zone_id = ? AND retired_at IS NULL',
        [id]
      );
      if (activeRacks.length > 0) {
        return res.status(409).json({
          error: 'RELATION_CONFLICT',
          message: `Zona tidak dapat dihapus karena masih menaungi ${activeRacks.length} rak aktif (AC-28).`,
          activeRacks,
          requestId: req.requestId,
        });
      }

      const [zoneRows] = await db.query('SELECT warehouse_id FROM zones WHERE id = ?', [id]);
      await db.query('DELETE FROM zones WHERE id = ?', [id]);
      if (zoneRows.length > 0) {
        await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [zoneRows[0].warehouse_id]);
      }
      await logAudit({
        user_id: req.user?.id || 1,
        action: 'ZONE_DELETED',
        table_affected: 'zones',
        record_id: Number(id),
      });

      res.status(200).json({ message: 'Zona berhasil dihapus', requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },
};

module.exports = zoneController;
