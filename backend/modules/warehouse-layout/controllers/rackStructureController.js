/**
 * Rack Structure Controller
 * HTTP endpoints for inspecting, previewing diff, and updating physical bay-level rack structures.
 */

const db = require('../../../config/db');
const RackStructureService = require('../services/rackStructureService');

class RackStructureController {
  /**
   * GET /api/warehouse-layout/racks/:id/structure
   */
  static async getStructure(req, res, next) {
    try {
      const rackId = parseInt(req.params.id, 10);
      if (isNaN(rackId) || rackId <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_ID',
          message: 'Parameter ID rak harus berupa integer positif.',
          requestId: req.requestId,
        });
      }

      const data = await RackStructureService.getRackStructure(db, rackId);
      return res.status(200).json({
        status: 'success',
        data,
        requestId: req.requestId,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          status: 'error',
          code: err.code || 'STRUCTURE_ERROR',
          message: err.message,
          details: err.details || null,
          requestId: req.requestId,
        });
      }
      next(err);
    }
  }

  /**
   * POST /api/warehouse-layout/racks/:id/structure/preview (AC-09)
   */
  static async previewDiff(req, res, next) {
    try {
      const rackId = parseInt(req.params.id, 10);
      if (isNaN(rackId) || rackId <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_ID',
          message: 'Parameter ID rak harus berupa integer positif.',
          requestId: req.requestId,
        });
      }

      const data = await RackStructureService.previewDiff(db, rackId, req.body || {});
      return res.status(200).json({
        status: 'success',
        message: 'Kalkulasi preview perbedaan struktur rak berhasil',
        data,
        requestId: req.requestId,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          status: 'error',
          code: err.code || 'STRUCTURE_VALIDATION_ERROR',
          message: err.message,
          details: err.details || null,
          requestId: req.requestId,
        });
      }
      next(err);
    }
  }

  /**
   * PUT /api/warehouse-layout/racks/:id/structure (AC-24)
   */
  static async updateStructure(req, res, next) {
    let conn;
    try {
      const rackId = parseInt(req.params.id, 10);
      if (isNaN(rackId) || rackId <= 0) {
        return res.status(400).json({
          status: 'error',
          code: 'INVALID_ID',
          message: 'Parameter ID rak harus berupa integer positif.',
          requestId: req.requestId,
        });
      }

      conn = await db.getConnection();
      await conn.beginTransaction();

      const data = await RackStructureService.updateRackStructure(
        conn,
        rackId,
        req.body || {},
        req.user
      );

      await conn.commit();

      return res.status(200).json({
        status: 'success',
        message: 'Struktur fisik rak (bays, levels, dan matriks posisi) berhasil diperbarui secara atomik',
        data,
        requestId: req.requestId,
      });
    } catch (err) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_) {}
      }
      if (err.status) {
        return res.status(err.status).json({
          status: 'error',
          code: err.code || 'STRUCTURE_UPDATE_ERROR',
          message: err.message,
          details: err.details || null,
          requestId: req.requestId,
        });
      }
      next(err);
    } finally {
      if (conn) {
        conn.release();
      }
    }
  }
}

module.exports = RackStructureController;
