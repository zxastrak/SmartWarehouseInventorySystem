const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { loginLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), authController.register);
router.post('/login', loginLimiter, authController.login);
router.post('/reset-password', loginLimiter, authController.resetPassword);

module.exports = router;
