const express = require('express');
const locationController = require('../controllers/locationController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.get('/', authMiddleware.verifyToken, locationController.getAll);
router.get('/:id', authMiddleware.verifyToken, locationController.getById);

// Khusus Manager
router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), locationController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), locationController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), locationController.remove);

module.exports = router;