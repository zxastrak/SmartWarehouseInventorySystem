const express = require('express');
const router = express.Router();
const unitController = require('../controllers/unitController');
const authMiddleware = require('../middlewares/authMiddleware');

router.get('/', unitController.getAll);
router.post('/', authMiddleware.verifyToken, unitController.create);
router.put('/:id', authMiddleware.verifyToken, unitController.update);
router.delete('/:id', authMiddleware.verifyToken, unitController.delete);

module.exports = router;
