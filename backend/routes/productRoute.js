const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, productController.getAll);
router.get('/sku/:sku', authMiddleware.verifyToken, productController.findBySku); // buat scan barcode
router.get('/:id', authMiddleware.verifyToken, productController.getById);

// Relokasi rak / Putaway oleh staf atau manajer
router.patch('/:id/location', authMiddleware.verifyToken, productController.updateLocation);

// Penyesuaian stok opname / verifikasi fisik rak oleh staf atau manajer
router.post('/:id/adjust-stock', authMiddleware.verifyToken, productController.adjustStock);

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), productController.remove);

module.exports = router;