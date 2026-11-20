/**
 * Pathfinding Controller
 * Serves POST /warehouses/:id/path
 */

const PathService = require('../services/pathService');

const pathController = {
  findPath: async (req, res) => {
    try {
      const warehouseId = req.params.id || req.params.warehouseId;
      const { from, to, agent } = req.body;

      if (!from || typeof from !== 'string' || from.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: "Field 'from' (titik asal) wajib diisi berupa string.",
          requestId: req.requestId,
        });
      }

      if (!to || typeof to !== 'string' || to.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'VALIDATION_ERROR',
          message: "Field 'to' (titik tujuan) wajib diisi berupa string.",
          requestId: req.requestId,
        });
      }

      const result = await PathService.calculatePath(warehouseId, from, to, agent);

      return res.status(200).json({
        success: true,
        data: result,
        requestId: req.requestId,
      });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({
        success: false,
        error: err.code || 'INTERNAL_SERVER_ERROR',
        message: err.message || 'Terjadi kesalahan saat menghitung jalur rute.',
        requestId: req.requestId,
      });
    }
  },
};

module.exports = pathController;
