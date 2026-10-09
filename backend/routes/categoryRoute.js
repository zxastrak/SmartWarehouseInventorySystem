const express = require('express');
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

// Semua yang login (Manager & Staf) boleh LIHAT data kategori
router.get('/', authMiddleware.verifyToken, categoryController.getAll);
router.get('/:id', authMiddleware.verifyToken, categoryController.getById);

// Cuma Manager yang boleh CREATE, UPDATE, DELETE
router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), categoryController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), categoryController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), categoryController.remove);

module.exports = router;