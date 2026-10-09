const express = require('express');
const router = express.Router();
const stockTransactionController = require('../controllers/stockTransactionController');
const authMiddleware = require('../middlewares/authMiddleware');

// Staf yang mencatat transaksi (sesuai dokumen SUSUNO: pelaksana lapangan)
router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('staf'), stockTransactionController.create);

// Manager lihat semua transaksi
router.get('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), stockTransactionController.getAll);

// Riwayat milik sendiri (Staf & Manager)
router.get('/me', authMiddleware.verifyToken, stockTransactionController.getMine);

// Riwayat per produk (semua yang login)
router.get('/product/:product_id', authMiddleware.verifyToken, stockTransactionController.getByProduct);

module.exports = router;