const express = require('express');
const outboundController = require('../controllers/outboundController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.verifyToken);

router.get('/', outboundController.getAll);
router.get('/:id', outboundController.getById);
router.post('/', authMiddleware.authorizeRole('manager'), outboundController.create);
router.post('/:id/inspect', outboundController.inspect);
router.put('/:id/inspect', outboundController.inspect);
router.post('/:id/dispatch', authMiddleware.authorizeRole('manager'), outboundController.dispatch);
router.post('/:id/complete', authMiddleware.authorizeRole('manager'), outboundController.dispatch);
router.post('/:id/ship', authMiddleware.authorizeRole('manager'), outboundController.dispatch);
router.put('/:id/status', outboundController.updateStatus);
router.delete('/:id', authMiddleware.authorizeRole('manager'), outboundController.remove);

module.exports = router;
