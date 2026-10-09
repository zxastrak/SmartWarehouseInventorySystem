const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, productController.getAll);
router.get('/sku/:sku', authMiddleware.verifyToken, productController.findBySku); // buat scan barcode
router.get('/:id', authMiddleware.verifyToken, productController.getById);

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.remove);

module.exports = router;