const Message = require('../models/Message');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

// Get user's conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20 } = req.query;

    const conversations = await Message.getUserConversations(userId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Get total count for pagination
    const pipeline = [
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
          isDeleted: false
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ['$sender', userId] },
              '$receiver',
              '$sender'
            ]
          }
        }
      },
      { $count: 'total' }
    ];

    const totalResult = await Message.aggregate(pipeline);
    const total = totalResult[0]?.total || 0;

    res.json({
      success: true,
      data: conversations,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversations'
    });
  }
};

// Get conversation with specific user
const getConversation = async (req, res) => {
  try {
    const userId = req.userId;
    const { userId: otherUserId } = req.params;
    const {
      page = 1,
      limit = 50,
      beforeDate,
      afterDate,
      orderId
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      beforeDate,
      afterDate,
      orderId
    };

    const messages = await Message.getConversation(userId, otherUserId, options);

    // Mark messages as read
    const unreadMessageIds = messages
      .filter(msg => msg.receiver.toString() === userId && !msg.isRead)
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { isRead: true, readAt: new Date() }
      );
    }

    // Get total count
    const query = {
      $or: [
        { sender: userId, receiver: otherUserId },
        { sender: otherUserId, receiver: userId }
      ],
      isDeleted: false
    };

    if (beforeDate || afterDate) {
      query.sentAt = {};
      if (beforeDate) query.sentAt.$lt = new Date(beforeDate);
      if (afterDate) query.sentAt.$gt = new Date(afterDate);
    }

    if (orderId) {
      query.orderId = orderId;
    }

    const total = await Message.countDocuments(query);

    res.json({
      success: true,
      data: {
        messages,
        unreadCount: unreadMessageIds.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get conversation'
    });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { receiver, content, fileUrl, fileName, fileSize, fileType, orderId } = req.body;

    const message = new Message({
      sender: userId,
      receiver,
      content,
      fileUrl,
      fileName,
      fileSize,
      fileType,
      orderId
    });

    await message.save();

    // Populate sender and receiver
    await message.populate([
      { path: 'sender', select: 'fullName avatar' },
      { path: 'receiver', select: 'fullName avatar' }
    ]);

    // Send notification to receiver
    await Notification.createNotification({
      recipient,
      title: 'New Message',
      message: `You have a new message from ${message.sender.fullName}`,
      type: 'message',
      category: 'info',
      relatedId: message._id,
      relatedType: 'message'
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${receiver}`).emit('new_message', {
        message: message.toObject(),
        sender: message.sender
      });

      // Send typing stop event
      io.to(`user_${receiver}`).emit('user_stopped_typing', {
        userId: userId
      });
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send message'
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { userId: otherUserId } = req.params;
    const { messageIds } = req.body;

    let query = {
      receiver: userId,
      sender: otherUserId,
      isRead: false
    };

    if (messageIds && messageIds.length > 0) {
      query._id = { $in: messageIds };
    }

    const result = await Message.updateMany(
      query,
      { isRead: true, readAt: new Date() }
    );

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${otherUserId}`).emit('messages_read', {
        userId: userId,
        count: result.modifiedCount
      });
    }

    res.json({
      success: true,
      message: 'Messages marked as read',
      data: {
        markedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark messages as read'
    });
  }
};

// Delete message
const deleteMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is sender or receiver
    const isParticipant = message.sender.toString() === userId ||
                      message.receiver.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await message.deleteMessage(userId);

    res.json({
      success: true,
      message: 'Message deleted successfully'
    });
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete message'
    });
  }
};

// Edit message
const editMessage = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Message content is required'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is sender and message is recent (< 15 minutes)
    const isSender = message.sender.toString() === userId;
    const timeDiff = Date.now() - message.sentAt.getTime();
    const canEdit = isSender && timeDiff < (15 * 60 * 1000);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit this message'
      });
    }

    await message.editMessage(content);

    // Populate and return updated message
    await message.populate('sender receiver', 'fullName avatar');

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${message.receiver}`).emit('message_edited', {
        messageId: message._id,
        content,
        editedAt: message.editedAt
      });
    }

    res.json({
      success: true,
      message: 'Message edited successfully',
      data: message
    });
  } catch (error) {
    console.error('Edit message error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to edit message'
    });
  }
};

// Add reaction to message
const addReaction = async (req, res) => {
  try {
    const userId = req.userId;
    const { messageId } = req.params;
    const { emoji } = req.body;

    if (!emoji) {
      return res.status(400).json({
        success: false,
        error: 'Emoji is required'
      });
    }

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        error: 'Message not found'
      });
    }

    // Check if user is participant
    const isParticipant = message.sender.toString() === userId ||
                      message.receiver.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    await message.addReaction(userId, emoji);

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      const otherUserId = message.sender.toString() === userId
        ? message.receiver
        : message.sender;

      io.to(`user_${otherUserId}`).emit('message_reaction', {
        messageId: message._id,
        userId,
        emoji
      });
    }

    res.json({
      success: true,
      message: 'Reaction added successfully',
      data: message
    });
  } catch (error) {
    console.error('Add reaction error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add reaction'
    });
  }
};

// Get unread count
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.userId;

    const unreadCount = await Message.getUnreadCount(userId);

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

// Get order messages
const getOrderMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { orderId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Check if user is participant in order
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    const isParticipant = order.buyer.toString() === userId ||
                      order.seller.toString() === userId;

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    const messages = await Message.getOrderMessages(orderId, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Mark messages as read
    const unreadMessageIds = messages
      .filter(msg => msg.receiver.toString() === userId && !msg.isRead)
      .map(msg => msg._id);

    if (unreadMessageIds.length > 0) {
      await Message.updateMany(
        { _id: { $in: unreadMessageIds } },
        { isRead: true, readAt: new Date() }
      );
    }

    const total = await Message.countDocuments({
      orderId,
      isDeleted: false
    });

    res.json({
      success: true,
      data: {
        messages,
        unreadCount: unreadMessageIds.length
      },
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get order messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order messages'
    });
  }
};

// Search messages
const searchMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const { q, page = 1, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const messages = await Message.find({
      $or: [
        { sender: userId },
        { receiver: userId }
      ],
      content: { $regex: q, $options: 'i' },
      isDeleted: false
    })
      .populate('sender receiver', 'fullName avatar')
      .sort({ sentAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Message.countDocuments({
      $or: [
        { sender: userId },
        { receiver: userId }
      ],
      content: { $regex: q, $options: 'i' },
      isDeleted: false
    });

    res.json({
      success: true,
      data: messages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search messages error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search messages'
    });
  }
};

module.exports = {
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
};