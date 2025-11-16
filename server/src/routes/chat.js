const express = require('express');
const router = express.Router();
const {
  getConversations,
  getConversation,
  sendMessage,
  markAsRead,
  deleteMessage,
  editMessage,
  addReaction,
  getUnreadCount,
  getOrderMessages,
  searchMessages
} = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');
const { validateMessage } = require('../middleware/validation');

// Protected routes
router.get('/conversations', authenticate, getConversations);

router.get('/user/:userId', authenticate, getConversation);

router.post('/send', authenticate, validateMessage, sendMessage);

router.put('/user/:userId/read', authenticate, markAsRead);

router.delete('/message/:messageId', authenticate, deleteMessage);

router.put('/message/:messageId', authenticate, editMessage);

router.post('/message/:messageId/reaction', authenticate, addReaction);

router.get('/unread-count', authenticate, getUnreadCount);

router.get('/order/:orderId', authenticate, getOrderMessages);

router.get('/search', authenticate, searchMessages);

module.exports = router;