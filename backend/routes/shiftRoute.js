const express = require('express');
const router = express.Router();
const shiftController = require('../controllers/shiftController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/me', authMiddleware.verifyToken, shiftController.getMine);
router.get('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), shiftController.getAll);
router.get('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), shiftController.getById);

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), shiftController.create);
router.put('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), shiftController.update);
router.delete('/:id', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), shiftController.remove);

module.exports = router;