const express = require('express');
const router = express.Router();
const aiChatController = require('../controllers/aiChatController');
const authMiddleware = require('../middlewares/authMiddleware');

// Endpoint percakapan dengan AI Chatbot (dilindungi token login)
router.post('/chat', authMiddleware.verifyToken, aiChatController.chat);

// Endpoint reload Knowledge Base ke memory cache
router.post('/reload-kb', authMiddleware.verifyToken, aiChatController.reloadKnowledgeBase);

// Endpoint status AI & dokumen Knowledge Base
router.get('/status', authMiddleware.verifyToken, aiChatController.getStatus);

module.exports = router;
