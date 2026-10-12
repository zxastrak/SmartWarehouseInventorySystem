const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/check-in', authMiddleware.verifyToken, authMiddleware.authorizeRole('staf'), attendanceController.checkIn);
router.post('/check-out', authMiddleware.verifyToken, authMiddleware.authorizeRole('staf'), attendanceController.checkOut);
router.get('/me', authMiddleware.verifyToken, authMiddleware.authorizeRole('staf'), attendanceController.getMine);
router.get('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), attendanceController.getAll);

module.exports = router;