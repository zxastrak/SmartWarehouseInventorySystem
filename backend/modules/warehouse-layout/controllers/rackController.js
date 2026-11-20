/**
 * Rack CRUD & Aisle Access Controller
 * Authoritative Geometry Validation, Immutability, and Transactional Code Registry
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');
const LayoutValidationService = require('../services/layoutValidationService');
const { normalizeCode, isValidCode } = require('../../../../shared/layout-core/src/index');

const rackController = {
  create: async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const {
        warehouse_id,
        zone_id,
        rack_code,
        x_mm,
        y_mm,
        length_mm,
        depth_mm,
        height_mm,
        rotation = 0,
        max_weight_kg = null,
        max_volume_m3 = null,
      } = req.body;

      if (!warehouse_id || !rack_code || x_mm == null || y_mm == null || !length_mm || !depth_mm || !height_mm) {
        await conn.rollback();
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'warehouse_id, rack_code, x_mm, y_mm, length_mm, depth_mm, dan height_mm wajib diisi.',
          requestId: req.requestId,
        });
      }

      const normalizedRackCode = normalizeCode(rack_code);
      if (!isValidCode(normalizedRackCode)) {
        await conn.rollback();
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Format rack_code tidak valid. Gunakan huruf kapital, angka, dash, atau underscore.',
          requestId: req.requestId,
        });
      }

      // 1. Cek gudang
      const [whRows] = await conn.query('SELECT * FROM warehouses WHERE id = ?', [warehouse_id]);
      if (whRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Warehouse tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      const warehouse = whRows[0];

      // 2. Cek apakah kode sudah terdaftar di code_registry (AC-23)
      const [regRows] = await conn.query(
        'SELECT id FROM code_registry WHERE warehouse_id = ? AND code_type = ? AND normalized_code = ?',
        [warehouse_id, 'RACK', normalizedRackCode]
      );
      if (regRows.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          error: 'DUPLICATE_CODE',
          message: `Kode rak '${normalizedRackCode}' sudah pernah diterbitkan atau terdaftar di registry gudang ini.`,
          requestId: req.requestId,
        });
      }

      const rackCandidate = {
        x_mm: Number(x_mm),
        y_mm: Number(y_mm),
        length_mm: Number(length_mm),
        depth_mm: Number(depth_mm),
        height_mm: Number(height_mm),
        rotation: Number(rotation),
      };

      // 3. Validasi batas dalam gudang (AC-04)
      const boundCheck = LayoutValidationService.validateWarehouseBoundary(rackCandidate, warehouse);
      if (!boundCheck.valid) {
        await conn.rollback();
        return res.status(422).json({
          error: boundCheck.conflict.code,
          ...boundCheck.conflict,
          requestId: req.requestId,
        });
      }

      // 4. Validasi containment zona (jika zone_id diisi)
      if (zone_id) {
        const [zoneRows] = await conn.query('SELECT * FROM zones WHERE id = ? AND warehouse_id = ?', [
          zone_id,
          warehouse_id,
        ]);
        if (zoneRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            error: 'RESOURCE_NOT_FOUND',
            message: 'Zona tidak ditemukan pada gudang ini.',
            requestId: req.requestId,
          });
        }
        const zoneCheck = LayoutValidationService.validateZoneContainment(rackCandidate, zoneRows[0]);
        if (!zoneCheck.valid) {
          await conn.rollback();
          return res.status(422).json({
            error: zoneCheck.conflict.code,
            ...zoneCheck.conflict,
            requestId: req.requestId,
          });
        }
      }

      // 5. Validasi tabrakan fisik dengan rak lain, lorong, dan rintangan (AC-02)
      const colCheck = await LayoutValidationService.validatePhysicalCollisions(
        conn,
        warehouse_id,
        'rack',
        rackCandidate
      );
      if (!colCheck.valid) {
        await conn.rollback();
        return res.status(409).json({
          error: colCheck.conflict.code,
          ...colCheck.conflict,
          requestId: req.requestId,
        });
      }

      // 6. Simpan Rak
      const [rackResult] = await conn.query(
        `INSERT INTO racks (warehouse_id, zone_id, rack_code, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation, color_hex, max_weight_kg, max_volume_m3, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          warehouse_id,
          zone_id || null,
          normalizedRackCode,
          rackCandidate.x_mm,
          rackCandidate.y_mm,
          rackCandidate.length_mm,
          rackCandidate.depth_mm,
          rackCandidate.height_mm,
          rackCandidate.rotation,
          req.body.color_hex || '#5c732b',
          max_weight_kg,
          max_volume_m3,
        ]
      );

      const newRackId = rackResult.insertId;

      // 7. Daftarkan permanen ke code_registry dalam transaksi yang sama (AC-23)
      await conn.query(
        `INSERT INTO code_registry (warehouse_id, code_type, normalized_code, entity_id)
         VALUES (?, 'RACK', ?, ?)`,
        [warehouse_id, normalizedRackCode, newRackId]
      );

      // 8. Naikkan layout_version gudang (Item 3)
      await conn.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [warehouse_id]);

      // 9. Catat Audit Log
      await logAudit({
        user_id: req.user?.id || 1,
        action: 'RACK_CREATED',
        table_affected: 'racks',
        record_id: newRackId,
      });

      await conn.commit();

      res.status(201).json({
        message: 'Rak berhasil dibuat',
        rackId: newRackId,
        rack_code: normalizedRackCode,
        requestId: req.requestId,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    } finally {
      conn.release();
    }
  },

  getByWarehouse: async (req, res) => {
    try {
      const { warehouseId } = req.params;
      const [rows] = await db.query(
        `SELECT r.*, z.zone_code, z.name as zone_name
         FROM racks r
         LEFT JOIN zones z ON r.zone_id = z.id
         WHERE r.warehouse_id = ? AND r.retired_at IS NULL
         ORDER BY r.id ASC`,
        [warehouseId]
      );
      res.status(200).json({ data: rows, requestId: req.requestId });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      const [racks] = await db.query('SELECT * FROM racks WHERE id = ?', [id]);
      if (racks.length === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Rak tidak ditemukan.',
          requestId: req.requestId,
        });
      }

      // Ambil daftar akses aisle
      const [aisles] = await db.query(
        `SELECT raa.id, raa.aisle_id, raa.access_side, raa.is_primary, a.aisle_code, a.name as aisle_name
         FROM rack_aisle_access raa
         JOIN aisles a ON raa.aisle_id = a.id
         WHERE raa.rack_id = ?`,
        [id]
      );

      res.status(200).json({
        data: {
          ...racks[0],
          aisle_access: aisles,
        },
        requestId: req.requestId,
      });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  update: async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { id } = req.params;
      const { zone_id, x_mm, y_mm, length_mm, depth_mm, height_mm, rotation = 0, rack_code, color_hex } = req.body;

      const [existing] = await conn.query('SELECT * FROM racks WHERE id = ?', [id]);
      if (existing.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Rak tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      const currentRack = existing[0];

      // Tolak upaya perubahan rack_code (AC-10)
      if (rack_code && normalizeCode(rack_code) !== currentRack.rack_code) {
        await conn.rollback();
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'AC-10: rack_code bersifat immutable dan dilarang diubah.',
          requestId: req.requestId,
        });
      }

      const [whRows] = await conn.query('SELECT * FROM warehouses WHERE id = ?', [currentRack.warehouse_id]);
      const warehouse = whRows[0];

      const rackCandidate = {
        x_mm: x_mm != null ? Number(x_mm) : currentRack.x_mm,
        y_mm: y_mm != null ? Number(y_mm) : currentRack.y_mm,
        length_mm: length_mm != null ? Number(length_mm) : currentRack.length_mm,
        depth_mm: depth_mm != null ? Number(depth_mm) : currentRack.depth_mm,
        height_mm: height_mm != null ? Number(height_mm) : currentRack.height_mm,
        rotation: rotation != null ? Number(rotation) : currentRack.rotation,
      };

      // Validasi batas dalam gudang (AC-04)
      const boundCheck = LayoutValidationService.validateWarehouseBoundary(rackCandidate, warehouse);
      if (!boundCheck.valid) {
        await conn.rollback();
        return res.status(422).json({
          error: boundCheck.conflict.code,
          ...boundCheck.conflict,
          requestId: req.requestId,
        });
      }

      // Validasi tabrakan fisik (exclude self) (AC-02)
      const colCheck = await LayoutValidationService.validatePhysicalCollisions(
        conn,
        currentRack.warehouse_id,
        'rack',
        rackCandidate,
        Number(id)
      );
      if (!colCheck.valid) {
        await conn.rollback();
        return res.status(409).json({
          error: colCheck.conflict.code,
          ...colCheck.conflict,
          requestId: req.requestId,
        });
      }

      await conn.query(
        `UPDATE racks
         SET zone_id = ?, x_mm = ?, y_mm = ?, length_mm = ?, depth_mm = ?, height_mm = ?, rotation = ?, color_hex = COALESCE(?, color_hex), version = version + 1
         WHERE id = ?`,
        [
          zone_id !== undefined ? zone_id : currentRack.zone_id,
          rackCandidate.x_mm,
          rackCandidate.y_mm,
          rackCandidate.length_mm,
          rackCandidate.depth_mm,
          rackCandidate.height_mm,
          rackCandidate.rotation,
          color_hex || null,
          id,
        ]
      );

      // Naikkan layout_version gudang
      await conn.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [
        currentRack.warehouse_id,
      ]);

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'RACK_UPDATED',
        table_affected: 'racks',
        record_id: Number(id),
      });

      await conn.commit();
      res.status(200).json({ message: 'Rak berhasil diperbarui', requestId: req.requestId });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    } finally {
      conn.release();
    }
  },

  setAisleAccess: async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const { id } = req.params;
      const { aisles } = req.body; // Array of { aisle_id, access_side, is_primary }

      if (!Array.isArray(aisles)) {
        await conn.rollback();
        return res.status(400).json({
          error: 'VALIDATION_ERROR',
          message: 'Body aisles harus berupa array.',
          requestId: req.requestId,
        });
      }

      const [racks] = await conn.query('SELECT * FROM racks WHERE id = ?', [id]);
      if (racks.length === 0) {
        await conn.rollback();
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Rak tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      const rack = racks[0];

      // 1. Validasi maksimal 1 primary aisle (AC-21)
      const primaryCount = aisles.filter((a) => a.is_primary).length;
      if (primaryCount > 1) {
        await conn.rollback();
        return res.status(422).json({
          error: 'VALIDATION_ERROR',
          message: 'AC-21: Rak hanya boleh memiliki maksimal satu primary aisle.',
          requestId: req.requestId,
        });
      }

      // 2. Validasi seluruh aisle berada dalam warehouse yang sama (AC-21)
      for (const item of aisles) {
        const [aRows] = await conn.query('SELECT warehouse_id FROM aisles WHERE id = ?', [item.aisle_id]);
        if (aRows.length === 0) {
          await conn.rollback();
          return res.status(404).json({
            error: 'RESOURCE_NOT_FOUND',
            message: `Aisle dengan id ${item.aisle_id} tidak ditemukan.`,
            requestId: req.requestId,
          });
        }
        if (aRows[0].warehouse_id !== rack.warehouse_id) {
          await conn.rollback();
          return res.status(422).json({
            error: 'VALIDATION_ERROR',
            message: `AC-21: Aisle ${item.aisle_id} berada di warehouse berbeda dengan rak.`,
            requestId: req.requestId,
          });
        }
      }

      // 3. Reset dan insert relasi akses baru
      await conn.query('DELETE FROM rack_aisle_access WHERE rack_id = ?', [id]);

      for (const item of aisles) {
        await conn.query(
          `INSERT INTO rack_aisle_access (rack_id, aisle_id, access_side, is_primary)
           VALUES (?, ?, ?, ?)`,
          [id, item.aisle_id, item.access_side || 'left', item.is_primary ? 1 : 0]
        );
      }

      // Naikkan layout_version gudang
      await conn.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [
        rack.warehouse_id,
      ]);

      await logAudit({
        user_id: req.user?.id || 1,
        action: 'RACK_AISLE_ACCESS_UPDATED',
        table_affected: 'rack_aisle_access',
        record_id: Number(id),
      });

      await conn.commit();
      res.status(200).json({
        message: 'Akses lorong rak berhasil diperbarui (AC-05)',
        requestId: req.requestId,
      });
    } catch (err) {
      await conn.rollback();
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    } finally {
      conn.release();
    }
  },

  retireOrDelete: async (req, res) => {
    try {
      const { id } = req.params;

      const [racks] = await db.query('SELECT * FROM racks WHERE id = ?', [id]);
      if (racks.length === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          message: 'Rak tidak ditemukan.',
          requestId: req.requestId,
        });
      }

      // AC-11: Cek apakah rak memiliki riwayat stok / inventori terkait
      const [histLocs] = await db.query(
        `SELECT COUNT(*) as c
         FROM storage_locations sl
         JOIN products p ON p.location_id = sl.id
         WHERE sl.rack_id = ?`,
        [id]
      );

      const hasHistory = histLocs[0].c > 0;

      if (hasHistory) {
        // Hanya boleh retire (soft delete) (AC-11)
        await db.query('UPDATE racks SET retired_at = NOW() WHERE id = ?', [id]);
        await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [racks[0].warehouse_id]);
        await logAudit({
          user_id: req.user?.id || 1,
          action: 'RACK_RETIRED',
          table_affected: 'racks',
          record_id: Number(id),
        });

        return res.status(200).json({
          message: 'Rak memiliki riwayat inventori sehingga status diubah menjadi RETIRED (soft-delete, AC-11).',
          retired: true,
          requestId: req.requestId,
        });
      }

      // Jika belum ada riwayat sama sekali, boleh di-retire atau di-hard delete bila tidak ada relasi terkunci
      try {
        await db.query('DELETE FROM racks WHERE id = ?', [id]);
        await db.query('UPDATE warehouses SET layout_version = layout_version + 1 WHERE id = ?', [racks[0].warehouse_id]);
        await logAudit({
          user_id: req.user?.id || 1,
          action: 'RACK_DELETED',
          table_affected: 'racks',
          record_id: Number(id),
        });
        return res.status(200).json({
          message: 'Rak belum memiliki riwayat transaksi sehingga berhasil dihapus fisik.',
          deleted: true,
          requestId: req.requestId,
        });
      } catch (e) {
        // Jika ada relasi bay/level child yang terkunci RESTRICT (AC-28)
        if (e.message && e.message.includes('foreign key constraint fails')) {
          await db.query('UPDATE racks SET retired_at = NOW() WHERE id = ?', [id]);
          return res.status(200).json({
            message: 'Rak memiliki struktur child sehingga dialihkan ke status RETIRED (AC-28).',
            retired: true,
            requestId: req.requestId,
          });
        }
        throw e;
      }
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },
};

module.exports = rackController;
