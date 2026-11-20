/**
 * Location Generator Controller (STEP 10)
 * HTTP handlers for previewing and executing bulk location generation.
 */

const db = require('../../../config/db');
const LocationGeneratorService = require('../services/locationGeneratorService');

class LocationGeneratorController {
  /**
   * POST /api/warehouse-layout/racks/:id/generate-locations/preview
   */
  static async preview(req, res, next) {
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

      const data = await LocationGeneratorService.preview(db, rackId, req.body || {});
      return res.status(200).json({
        status: 'success',
        data,
        requestId: req.requestId,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          status: 'error',
          code: err.code || 'GENERATOR_ERROR',
          message: err.message,
          details: err.details || null,
          requestId: req.requestId,
        });
      }
      next(err);
    }
  }

  /**
   * POST /api/warehouse-layout/racks/:id/generate-locations (AC-10, AC-13, AC-23)
   */
  static async generate(req, res, next) {
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

      const data = await LocationGeneratorService.generate(
        conn,
        rackId,
        req.body || {},
        req.user
      );

      await conn.commit();

      return res.status(201).json({
        status: 'success',
        message: 'Lokasi penyimpanan berhasil diterbitkan secara massal (append-first)',
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
          code: err.code || 'GENERATION_ERROR',
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

module.exports = LocationGeneratorController;
