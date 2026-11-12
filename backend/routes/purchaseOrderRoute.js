const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware.verifyToken);

router.post('/', authMiddleware.authorizeRole('manager'), purchaseOrderController.create);
router.get('/', purchaseOrderController.getAll);
router.get('/:id', purchaseOrderController.getById);
router.put('/:id', authMiddleware.authorizeRole('manager'), purchaseOrderController.update);
router.put('/:id/status', authMiddleware.authorizeRole('manager'), purchaseOrderController.updateStatus);
router.patch('/:id/status', authMiddleware.authorizeRole('manager'), purchaseOrderController.updateStatus);

module.exports = router;