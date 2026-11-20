/**
 * Layout Obstacle Objects Controller (Walls, Pillars, Doors, Docks)
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');
const LayoutValidationService = require('../services/layoutValidationService');

const layoutObjectController = {
  create: async (req, res) => {
    try {
      const { warehouse_id, object_type, name, x_mm, y_mm, width_mm, length_mm, rotation = 0, clearance_mm = 0 } = req.body;

      if (!warehouse_id || !object_type || !name || width_mm == null || length_mm == null) {
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'warehouse_id, object_type, name, width_mm, dan length_mm wajib diisi.',
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

      // Validasi batas dalam gudang
      const boundCheck = LayoutValidationService.validateWarehouseBoundary(
        { x_mm: x_mm || 0, y_mm: y_mm || 0, length_mm, depth_mm: width_mm, rotation },
        whRows[0]
      );
      if (!boundCheck.valid) {
        return res.status(422).json({
          error: boundCheck.conflict.code,
          ...boundCheck.conflict,
          requestId: req.requestId,
        });
      }

      const [result] = await db.query(
        `INSERT INTO layout_objects (warehouse_id, object_type, name, x_mm, y_mm, width_mm, length_mm, rotation, clearance_mm)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [warehouse_id, object_type, name.trim(), x_mm || 0, y_mm || 0, width_mm, length_mm, rotation, clearance_mm]
      );

      await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [warehouse_id]);

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'LAYOUT_OBJECT_CREATED',
        table_affected: 'layout_objects',
        record_id: result.insertId,
      });

      res.status(201).json({
        message: 'Objek layout berhasil dibuat',
        objectId: result.insertId,
        requestId: req.requestId,
      });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  getByWarehouse: async (req, res) => {
    try {
      const { warehouseId } = req.params;
      const [rows] = await db.query(
        'SELECT * FROM layout_objects WHERE warehouse_id = ? ORDER BY id ASC',
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
      const [objRows] = await db.query('SELECT warehouse_id FROM layout_objects WHERE id = ?', [id]);
      await db.query('DELETE FROM layout_objects WHERE id = ?', [id]);
      if (objRows.length > 0) {
        await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [objRows[0].warehouse_id]);
      }
      await logAudit({
        user_id: req.user?.id || 1,
        action: 'LAYOUT_OBJECT_DELETED',
        table_affected: 'layout_objects',
        record_id: Number(id),
      });
      res.status(200).json({ message: 'Objek layout berhasil dihapus', requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },
};

module.exports = layoutObjectController;
