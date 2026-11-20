/**
 * Layout Snapshot & Batch Patch Controller
 * ETag caching (304 Not Modified), optimistic locking, and atomic batch mutations.
 */

const db = require('../../../config/db');
const logAudit = require('../../../utils/audit');
const BatchPatchService = require('../services/batchPatchService');
const { createLayoutSnapshot } = require('../../../../shared/layout-core/src/index');

const layoutSnapshotController = {
  getSnapshot: async (req, res) => {
    try {
      const { id } = req.params;

      // 1. Ambil data gudang
      const [whRows] = await db.query('SELECT * FROM warehouses WHERE id = ?', [id]);
      if (whRows.length === 0) {
        return res.status(404).json({
          error: 'RESOURCE_NOT_FOUND',
          code: 'RESOURCE_NOT_FOUND',
          message: 'Warehouse tidak ditemukan.',
          requestId: req.requestId,
        });
      }
      const warehouse = whRows[0];

      // 2. Evaluasi ETag berbasis layout_version
      const etag = `W/"wh-${warehouse.id}-v${warehouse.layout_version}"`;
      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', 'private, no-cache, must-revalidate');

      const clientEtag = req.headers['if-none-match'];
      if (clientEtag && clientEtag === etag) {
        // HTTP 304 Not Modified - klien menggunakan cache lokal tanpa transfer payload
        return res.status(304).end();
      }

      // 3. Ambil data zona
      const [zones] = await db.query(
        'SELECT * FROM zones WHERE warehouse_id = ? ORDER BY id ASC',
        [id]
      );

      // 4. Ambil data lorong aktif
      const [aisles] = await db.query(
        'SELECT * FROM aisles WHERE warehouse_id = ? AND retired_at IS NULL ORDER BY id ASC',
        [id]
      );

      // 5. Ambil data rak aktif beserta relasi lorongnya (TANPA storage_locations)
      const [racks] = await db.query(
        'SELECT * FROM racks WHERE warehouse_id = ? AND retired_at IS NULL ORDER BY id ASC',
        [id]
      );

      // Ambil seluruh relasi aisle_access untuk rak di gudang ini
      const [accessRows] = await db.query(
        `SELECT raa.rack_id, raa.aisle_id, raa.access_side, raa.is_primary, a.aisle_code
         FROM rack_aisle_access raa
         JOIN racks r ON raa.rack_id = r.id
         JOIN aisles a ON raa.aisle_id = a.id
         WHERE r.warehouse_id = ? AND r.retired_at IS NULL`,
        [id]
      );

      const accessMap = new Map();
      for (const row of accessRows) {
        if (!accessMap.has(row.rack_id)) {
          accessMap.set(row.rack_id, []);
        }
        accessMap.get(row.rack_id).push({
          aisle_id: row.aisle_id,
          aisle_code: row.aisle_code,
          access_side: row.access_side,
          is_primary: Boolean(row.is_primary),
        });
      }

      const racksWithAccess = racks.map((r) => ({
        ...r,
        aisle_access: accessMap.get(r.id) || [],
      }));

      // 6. Ambil rintangan layout
      const [layoutObjects] = await db.query(
        'SELECT * FROM layout_objects WHERE warehouse_id = ? ORDER BY id ASC',
        [id]
      );

      // Format snapshot terstandarisasi (D4: tidak memuat lokasi)
      const snapshot = createLayoutSnapshot({
        warehouse,
        zones,
        aisles,
        racks: racksWithAccess,
        layoutObjects,
      });

      res.status(200).json({
        data: snapshot,
        layoutVersion: warehouse.layout_version,
        requestId: req.requestId,
      });
    } catch (err) {
      res.status(500).json({ error: 'INTERNAL_ERROR', code: 'INTERNAL_ERROR', message: err.message, requestId: req.requestId });
    }
  },

  patchLayout: async (req, res) => {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const { id } = req.params;
      const expectedLayoutVersion = req.body.expectedLayoutVersion ?? req.body.base_version;
      const { operations } = req.body;

      const result = await BatchPatchService.executeBatchPatch(
        conn,
        Number(id),
        Number(expectedLayoutVersion),
        operations,
        req.requestId
      );

      // Catat satu audit log untuk seluruh batch
      await logAudit({
        user_id: req.user?.id || 1,
        action: 'LAYOUT_BATCH_PATCHED',
        table_affected: 'warehouses',
        record_id: Number(id),
      });

      await conn.commit();

      // Respons hanya berisi entitas yang berubah beserta layoutVersion baru (bukan snapshot penuh)
      res.status(200).json({
        message: 'Batch patch berhasil diterapkan',
        layoutVersion: result.newLayoutVersion,
        updatedEntities: result.updatedEntities,
        requestId: req.requestId,
      });
    } catch (err) {
      await conn.rollback();
      const statusCode = err.status || 500;
      res.status(statusCode).json({
        code: err.code || 'INTERNAL_ERROR',
        error: err.code || 'INTERNAL_ERROR',
        conflictType: err.conflictType || undefined,
        message: err.message,
        details: err.details || undefined,
        requestId: req.requestId,
      });
    } finally {
      conn.release();
    }
  },
};

module.exports = layoutSnapshotController;
