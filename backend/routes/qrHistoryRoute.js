const express = require('express');
const router = express.Router();
const qrHistoryController = require('../controllers/qrHistoryController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, qrHistoryController.getAll);
router.post('/', authMiddleware.verifyToken, qrHistoryController.create);
router.delete('/:id', authMiddleware.verifyToken, qrHistoryController.delete);
router.delete('/', authMiddleware.verifyToken, qrHistoryController.clearAll);

module.exports = router;
