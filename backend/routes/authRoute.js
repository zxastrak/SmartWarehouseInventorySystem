const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');

router.post('/register', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), authController.register);
router.post('/login', authController.login);
router.post('/reset-password', authController.resetPassword); // publik, tanpa token

module.exports = router;