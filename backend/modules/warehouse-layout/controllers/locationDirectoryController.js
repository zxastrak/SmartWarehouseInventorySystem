/**
 * Location Directory Controller
 * Handles HTTP requests for Location Directory, Inspection & Manual Status Updates
 */

const locationDirectoryService = require('../services/locationDirectoryService');

class LocationDirectoryController {
  /**
   * GET /api/warehouse-layout/warehouses/:id/locations/overview
   */
  async getOverview(req, res) {
    try {
      const warehouseId = req.params.id;
      const data = await locationDirectoryService.getOverview(warehouseId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Gagal mengambil overview lokasi gudang.',
        requestId: req.layoutContext?.requestId
      });
    }
  }

  /**
   * GET /api/warehouse-layout/warehouses/:id/locations
   * Keyset cursor pagination (cursor, limit, search, rackId, zoneId, aisleId, manualStatus, includeRetired, withTotal)
   */
  async getLocations(req, res) {
    try {
      const warehouseId = req.params.id;
      const {
        cursor,
        limit,
        search,
        rack_id,
        zone_id,
        aisle_id,
        manual_status,
        include_retired,
        with_total
      } = req.query;

      const result = await locationDirectoryService.getLocations({
        warehouseId,
        cursor,
        limit,
        search,
        rackId: rack_id,
        zoneId: zone_id,
        aisleId: aisle_id,
        manualStatus: manual_status,
        includeRetired: include_retired === 'true' || include_retired === '1',
        withTotal: with_total === 'true' || with_total === '1'
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Gagal memuat direktori lokasi gudang.',
        requestId: req.layoutContext?.requestId
      });
    }
  }

  /**
   * GET /api/warehouse-layout/locations/:id
   */
  async getLocationById(req, res) {
    try {
      const locationId = req.params.id;
      const data = await locationDirectoryService.getLocationById(locationId);
      return res.status(200).json({
        success: true,
        data
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Gagal mengambil detail lokasi penyimpanan.',
        requestId: req.layoutContext?.requestId
      });
    }
  }

  /**
   * PATCH /api/warehouse-layout/locations/:id/manual-status
   * Memperbarui status manual lokasi (ACTIVE, BLOCKED, MAINTENANCE, RETIRED)
   * Dilindungi RBAC: requirePermission('location.configure')
   */
  async updateManualStatus(req, res) {
    try {
      const locationId = req.params.id;
      const { manual_status, reason } = req.body;
      const userId = req.user?.id || 1;

      const data = await locationDirectoryService.updateManualStatus(locationId, {
        manualStatus: manual_status,
        reason,
        userId
      });

      return res.status(200).json({
        success: true,
        message: `Status lokasi berhasil diperbarui menjadi ${data.manual_status}.`,
        data
      });
    } catch (err) {
      const status = err.status || 500;
      return res.status(status).json({
        success: false,
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Gagal memperbarui status operasional lokasi.',
        requestId: req.layoutContext?.requestId
      });
    }
  }
}

module.exports = new LocationDirectoryController();
