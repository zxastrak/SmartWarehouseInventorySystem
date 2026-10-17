const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');

const managerOnly = [authMiddleware.verifyToken, authMiddleware.authorizeRole('manager')];

router.get('/', ...managerOnly, userController.getAll);
router.get('/:id', ...managerOnly, userController.getById);
router.put('/:id', ...managerOnly, userController.update);
router.delete('/:id', ...managerOnly, userController.remove);
router.patch('/:id/activate', ...managerOnly, userController.activate);

module.exports = router;