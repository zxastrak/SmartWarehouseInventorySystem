const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplierController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, supplierController.getAll);
router.get('/:id', authMiddleware.verifyToken, supplierController.getById);

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), supplierController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), supplierController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), supplierController.remove);

module.exports = router;