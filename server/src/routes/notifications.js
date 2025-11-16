const express = require('express');
const router = express.Router();
const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
  sendBulkNotifications,
  getNotificationStats,
  getUnreadCount,
  searchNotifications,
  clearOldNotifications
} = require('../controllers/notificationController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Protected routes
router.get('/', authenticate, getUserNotifications);

router.get('/unread-count', authenticate, getUnreadCount);

router.get('/search', authenticate, searchNotifications);

router.put('/:notificationId/read', authenticate, markAsRead);

router.put('/mark-all-read', authenticate, markAllAsRead);

router.delete('/:notificationId', authenticate, deleteNotification);

// Admin only routes
router.post('/', authenticate, isAdmin, createNotification);

router.post('/bulk', authenticate, isAdmin, sendBulkNotifications);

router.get('/statistics', authenticate, isAdmin, getNotificationStats);

router.delete('/cleanup', authenticate, isAdmin, clearOldNotifications);

module.exports = router;