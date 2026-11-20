/**
 * Express Router for Warehouse Layout & Storage Mapping
 */

const express = require('express');
const router = express.Router();

const authMiddleware = require('../../../middlewares/authMiddleware');
const { attachLayoutContext, requirePermission } = require('../middlewares/layoutRbac');

const warehouseController = require('../controllers/warehouseController');
const zoneController = require('../controllers/zoneController');
const aisleController = require('../controllers/aisleController');
const rackController = require('../controllers/rackController');
const rackStructureController = require('../controllers/rackStructureController');
const locationGeneratorController = require('../controllers/locationGeneratorController');
const locationDirectoryController = require('../controllers/locationDirectoryController');
const layoutObjectController = require('../controllers/layoutObjectController');
const layoutSnapshotController = require('../controllers/layoutSnapshotController');
const pathController = require('../controllers/pathController');

// Global middleware untuk modul warehouse-layout
router.use(attachLayoutContext);
router.use(authMiddleware.verifyToken);

// 0. Snapshot Layout & Batch Patch (STEP 4)
router.get('/warehouses/:id/layout', requirePermission('layout.view'), layoutSnapshotController.getSnapshot);
router.patch('/warehouses/:id/layout', requirePermission('layout.edit'), layoutSnapshotController.patchLayout);

// 0.1 Spatial Pathfinding & Routing (Phase 5)
router.post('/warehouses/:id/path', requirePermission('layout.view'), pathController.findPath);

// 1. Warehouses
router.post('/warehouses', requirePermission('layout.edit'), warehouseController.create);
router.get('/warehouses', requirePermission('layout.view'), warehouseController.getAll);
router.get('/warehouses/:id', requirePermission('layout.view'), warehouseController.getById);
router.put('/warehouses/:id', requirePermission('layout.edit'), warehouseController.update);

// 2. Zones
router.post('/zones', requirePermission('layout.edit'), zoneController.create);
router.get('/warehouses/:warehouseId/zones', requirePermission('layout.view'), zoneController.getByWarehouse);
router.delete('/zones/:id', requirePermission('layout.edit'), zoneController.remove);

// 3. Aisles
router.post('/aisles', requirePermission('layout.edit'), aisleController.create);
router.get('/warehouses/:warehouseId/aisles', requirePermission('layout.view'), aisleController.getByWarehouse);
router.delete('/aisles/:id', requirePermission('layout.edit'), aisleController.retire);

// 4. Racks & Aisle Access
router.post('/racks', requirePermission('layout.edit'), rackController.create);
router.get('/warehouses/:warehouseId/racks', requirePermission('layout.view'), rackController.getByWarehouse);
router.get('/racks/:id', requirePermission('layout.view'), rackController.getById);
router.put('/racks/:id', requirePermission('layout.edit'), rackController.update);
router.put('/racks/:id/aisles', requirePermission('layout.edit'), rackController.setAisleAccess);
router.delete('/racks/:id', requirePermission('layout.edit'), rackController.retireOrDelete);

// 4.1 Rack Physical Structure & Matrix (STEP 8)
router.get('/racks/:id/structure', requirePermission('layout.view'), rackStructureController.getStructure);
router.post(
  '/racks/:id/structure/preview',
  requirePermission('location.configure'),
  rackStructureController.previewDiff
);
router.put(
  '/racks/:id/structure',
  requirePermission('location.configure'),
  rackStructureController.updateStructure
);

// 4.2 Location Bulk Generator & Pattern Expansion (STEP 10)
router.post(
  '/racks/:id/generate-locations/preview',
  requirePermission('location.configure'),
  locationGeneratorController.preview
);
router.post(
  '/racks/:id/generate-locations',
  requirePermission('location.configure'),
  locationGeneratorController.generate
);

// 4.3 Location Directory & Inspector (STEP 12)
router.get(
  '/warehouses/:id/locations/overview',
  requirePermission('layout.view'),
  locationDirectoryController.getOverview
);
router.get(
  '/warehouses/:id/locations',
  requirePermission('layout.view'),
  locationDirectoryController.getLocations
);
router.get(
  '/locations/:id',
  requirePermission('layout.view'),
  locationDirectoryController.getLocationById
);
router.patch(
  '/locations/:id/manual-status',
  requirePermission('location.configure'),
  locationDirectoryController.updateManualStatus
);

// 5. Layout Obstacle Objects
router.post('/layout-objects', requirePermission('layout.edit'), layoutObjectController.create);
router.get(
  '/warehouses/:warehouseId/layout-objects',
  requirePermission('layout.view'),
  layoutObjectController.getByWarehouse
);
router.delete('/layout-objects/:id', requirePermission('layout.edit'), layoutObjectController.remove);

module.exports = router;
