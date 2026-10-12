const express = require('express');
const router = express.Router();
const auditLogController = require('../controllers/auditLogController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', authMiddleware.verifyToken, authMiddleware.authorizeRole('manager'), auditLogController.getAll);

module.exports = router;