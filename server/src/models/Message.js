const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Sender is required']
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Receiver is required']
  },
  content: {
    type: String,
    required: function() {
      return !this.fileUrl;
    },
    trim: true,
    maxlength: [2000, 'Message cannot exceed 2000 characters']
  },
  fileUrl: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+/i.test(v);
      },
      message: 'Please provide a valid file URL'
    }
  },
  fileName: {
    type: String,
    maxlength: [255, 'File name cannot exceed 255 characters']
  },
  fileSize: {
    type: Number,
    min: 0,
    validate: {
      validator: function(v) {
        return !this.fileUrl || v > 0;
      },
      message: 'File size is required when file is uploaded'
    }
  },
  fileType: {
    type: String,
    enum: {
      values: ['image', 'document', 'audio', 'video'],
      message: 'Invalid file type'
    },
    default: null
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  reactions: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    emoji: {
      type: String,
      required: true,
      maxlength: 10
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      default: null
    }
  },
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'low'],
    default: 'normal'
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
messageSchema.index({ sender: 1, receiver: 1, sentAt: -1 });
messageSchema.index({ receiver: 1, isRead: 1, sentAt: -1 });
messageSchema.index({ orderId: 1, sentAt: 1 });
messageSchema.index({ replyTo: 1 });
messageSchema.index({ isDeleted: 1, sentAt: -1 });

// Pre-save middleware to validate sender and receiver
messageSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');

    const sender = await User.findById(this.sender);
    const receiver = await User.findById(this.receiver);

    if (!sender || !sender.isActive) {
      const error = new Error('Sender account is not active');
      error.status = 400;
      return next(error);
    }

    if (!receiver || !receiver.isActive) {
      const error = new Error('Receiver account is not active');
      error.status = 400;
      return next(error);
    }

    if (this.sender.toString() === this.receiver.toString()) {
      const error = new Error('Cannot send message to yourself');
      error.status = 400;
      return next(error);
    }

    // Validate order relationship if orderId is provided
    if (this.orderId) {
      const Order = mongoose.model('Order');
      const order = await Order.findById(this.orderId);

      if (!order) {
        const error = new Error('Order not found');
        error.status = 404;
        return next(error);
      }

      const isParticipant = order.buyer.toString() === this.sender.toString() ||
                           order.seller.toString() === this.sender.toString();

      if (!isParticipant) {
        const error = new Error('You are not a participant in this order');
        error.status = 403;
        return next(error);
      }
    }
  }
  next();
});

// Pre-save middleware to update read timestamp
messageSchema.pre('save', function(next) {
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }
  next();
});

// Static method to get conversation
messageSchema.statics.getConversation = function(userId1, userId2, options = {}) {
  const { page = 1, limit = 50, beforeDate, afterDate, orderId } = options;

  const query = {
    $or: [
      { sender: userId1, receiver: userId2 },
      { sender: userId2, receiver: userId1 }
    ],
    isDeleted: false
  };

  if (beforeDate) {
    query.sentAt = { ...query.sentAt, $lt: new Date(beforeDate) };
  }

  if (afterDate) {
    query.sentAt = { ...query.sentAt, $gt: new Date(afterDate) };
  }

  if (orderId) {
    query.orderId = orderId;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('sender', 'fullName avatar')
    .populate('receiver', 'fullName avatar')
    .populate('replyTo', 'content sender')
    .sort({ sentAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get user conversations
messageSchema.statics.getUserConversations = function(userId, options = {}) {
  const { page = 1, limit = 20 } = options;

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
        },
        lastMessage: { $last: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$receiver', userId] },
                  { $eq: ['$isRead', false] }
                ]
              },
              1,
              0
            ]
          }
        },
        totalMessages: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'otherUser'
      }
    },
    {
      $unwind: '$otherUser'
    },
    {
      $project: {
        _id: 1,
        otherUser: {
          _id: '$otherUser._id',
          fullName: '$otherUser.fullName',
          avatar: '$otherUser.avatar'
        },
        lastMessage: 1,
        unreadCount: 1,
        totalMessages: 1
      }
    },
    { $sort: { 'lastMessage.sentAt': -1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit }
  ];

  return this.aggregate(pipeline);
};

// Static method to get unread count
messageSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });
};

// Static method to get order messages
messageSchema.statics.getOrderMessages = function(orderId, options = {}) {
  const { page = 1, limit = 50 } = options;
  const skip = (page - 1) * limit;

  return this.find({ orderId, isDeleted: false })
    .populate('sender', 'fullName avatar')
    .populate('receiver', 'fullName avatar')
    .sort({ sentAt: 1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to mark as read
messageSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to edit message
messageSchema.methods.editMessage = function(newContent) {
  this.content = newContent;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Instance method to delete message
messageSchema.methods.deleteMessage = function(deletedBy) {
  this.isDeleted = true;
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// Instance method to add reaction
messageSchema.methods.addReaction = function(userId, emoji) {
  // Remove existing reaction by this user
  this.reactions = this.reactions.filter(r => r.user.toString() !== userId.toString());

  // Add new reaction
  this.reactions.push({
    user: userId,
    emoji: emoji,
    createdAt: new Date()
  });

  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);