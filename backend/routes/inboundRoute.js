const express = require('express');
const inboundController = require('../controllers/inboundController');
const authMiddleware = require('../middlewares/authMiddleware');

const router = express.Router();

router.use(authMiddleware.verifyToken);

router.get('/', inboundController.getAll);
router.get('/:id', inboundController.getById);
router.post('/', inboundController.create);
router.put('/:id', inboundController.update);
router.put('/:id/status', inboundController.updateStatus);
router.post('/:id/inspect', inboundController.inspect);
router.put('/:id/inspect', inboundController.inspect);
router.post('/:id/receive', inboundController.completeReceiving);
router.delete('/:id', inboundController.remove);

module.exports = router;
