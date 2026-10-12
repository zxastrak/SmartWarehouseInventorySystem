const express = require('express');
const router = express.Router();
const purchaseOrderController = require('../controllers/purchaseOrderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), purchaseOrderController.create);
router.get('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), purchaseOrderController.getAll);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), purchaseOrderController.getById);
router.patch('/:id/status', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), purchaseOrderController.updateStatus);

module.exports = router;