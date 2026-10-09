const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const router = express.Router();

router.post('/register', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), authController.register);
router.post('/login', authController.login);

module.exports = router;