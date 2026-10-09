const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, taskController.getAll);
router.get('/:id', authMiddleware.verifyToken, taskController.getById);
router.get('/:id/history', authMiddleware.verifyToken, taskController.getHistory);

router.post('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), taskController.create);

// PATCH = ubah sebagian data saja (bukan ganti seluruh record seperti PUT)
router.patch('/:id/reassign', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager', 'staf'), taskController.reassign);
router.patch('/:id/status', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager', 'staf'), taskController.updateStatus);

module.exports = router;