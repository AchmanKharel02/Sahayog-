const Notification = require('../models/Notification');

// Get user notifications
const getUserNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      page = 1,
      limit = 20,
      type,
      isRead,
      category
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      isRead,
      category
    };

    const notifications = await Notification.getUserNotifications(userId, options);

    // Get total count for pagination
    const query = { recipient: userId };
    if (type) query.type = type;
    if (typeof isRead === 'boolean') query.isRead = isRead;
    if (category) query.category = category;

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get user notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notifications'
    });
  }
};

// Mark notification as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check ownership
    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.userId;

    await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark all notifications as read'
    });
  }
};

// Delete notification
const deleteNotification = async (req, res) => {
  try {
    const userId = req.userId;
    const { notificationId } = req.params;

    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found'
      });
    }

    // Check ownership
    if (notification.recipient.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete notification'
    });
  }
};

// Create notification (admin/internal use)
const createNotification = async (req, res) => {
  try {
    const {
      recipient,
      title,
      message,
      type,
      category = 'info',
      actionUrl,
      actionText,
      imageUrl,
      batchId,
      tags
    } = req.body;

    const notification = await Notification.createNotification({
      recipient,
      title,
      message,
      type,
      category,
      actionUrl,
      actionText,
      imageUrl,
      batchId,
      tags,
      // Mark as sent immediately
      isPushSent: true,
      pushSentAt: new Date()
    });

    res.status(201).json({
      success: true,
      message: 'Notification created successfully',
      data: notification
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create notification'
    });
  }
};

// Send bulk notifications (admin only)
const sendBulkNotifications = async (req, res) => {
  try {
    const {
      recipients,
      title,
      message,
      type = 'system',
      category = 'info',
      actionUrl,
      actionText,
      imageUrl
    } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Recipients array is required'
      });
    }

    const User = require('../models/User');
    const users = await User.find({
      _id: { $in: recipients },
      isActive: true
    });

    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid recipients found'
      });
    }

    const notifications = await Notification.createBulkNotifications(users, {
      title,
      message,
      type,
      category,
      actionUrl,
      actionText,
      imageUrl
    });

    res.status(201).json({
      success: true,
      message: 'Bulk notifications sent successfully',
      data: {
        sentCount: notifications.length,
        totalRequested: recipients.length
      }
    });
  } catch (error) {
    console.error('Send bulk notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send bulk notifications'
    });
  }
};

// Get notification statistics (admin only)
const getNotificationStats = async (req, res) => {
  try {
    const { userId, startDate, endDate } = req.query;

    const stats = await Notification.getStatistics({
      userId,
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get notification statistics'
    });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const unreadCount = await Notification.getUnreadCount(userId);

    res.json({
      success: true,
      data: {
        unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unread count'
    });
  }
};

// Search notifications
const searchNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const query = {
      recipient: userId,
      $or: [
        { title: { $regex: q, $options: 'i' } },
        { message: { $regex: q, $options: 'i' } }
      ]
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const notifications = await Notification.find(query)
      .populate('metadata.sender', 'fullName avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);

    res.json({
      success: true,
      data: notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search notifications'
    });
  }
};

// Clear old notifications (maintenance task)
const clearOldNotifications = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date(Date.now() - (days * 24 * 60 * 60 * 1000));

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      isRead: true
    });

    res.json({
      success: true,
      message: `Cleared ${result.deletedCount} old notifications`,
      data: {
        deletedCount: result.deletedCount,
        cutoffDate
      }
    });
  } catch (error) {
    console.error('Clear old notifications error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to clear old notifications'
    });
  }
};

module.exports = {
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
};