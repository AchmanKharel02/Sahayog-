const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Recipient is required']
  },
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: [100, 'Title cannot exceed 100 characters']
  },
  message: {
    type: String,
    required: [true, 'Message is required'],
    trim: true,
    maxlength: [500, 'Message cannot exceed 500 characters']
  },
  type: {
    type: String,
    enum: {
      values: [
        'order',
        'message',
        'review',
        'payment',
        'withdrawal',
        'system',
        'security',
        'promotion',
        'profile',
        'service'
      ],
      message: 'Invalid notification type'
    },
    required: [true, 'Notification type is required']
  },
  category: {
    type: String,
    enum: {
      values: ['info', 'success', 'warning', 'error', 'urgent'],
      message: 'Invalid notification category'
    },
    default: 'info'
  },
  priority: {
    type: String,
    enum: {
      values: ['low', 'normal', 'high', 'urgent'],
      message: 'Invalid notification priority'
    },
    default: 'normal'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date,
    default: null
  },
  isPushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: {
    type: Date,
    default: null
  },
  isEmailSent: {
    type: Boolean,
    default: false
  },
  emailSentAt: {
    type: Date,
    default: null
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  relatedType: {
    type: String,
    enum: ['order', 'message', 'service', 'user', 'withdrawal', 'review'],
    default: null
  },
  actionUrl: {
    type: String,
    maxlength: [500, 'Action URL cannot exceed 500 characters']
  },
  actionText: {
    type: String,
    maxlength: [50, 'Action text cannot exceed 50 characters']
  },
  imageUrl: {
    type: String,
    validate: {
      validator: function(v) {
        if (!v) return true;
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Please provide a valid image URL'
    }
  },
  metadata: {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    device: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'email', 'push'],
      default: null
    },
    ipAddress: String,
    userAgent: String,
    platform: {
      type: String,
      enum: ['android', 'ios', 'web'],
      default: null
    }
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Default expire after 30 days
      const date = new Date();
      date.setDate(date.getDate() + 30);
      return date;
    }
  },
  isSilent: {
    type: Boolean,
    default: false
  },
  batchId: {
    type: String,
    maxlength: [50, 'Batch ID cannot exceed 50 characters']
  },
  tags: [{
    type: String,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  localization: {
    locale: {
      type: String,
      default: 'en'
    },
    titleTranslations: {
      type: Map,
      of: String,
      default: new Map()
    },
    messageTranslations: {
      type: Map,
      of: String,
      default: new Map()
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ priority: 1, isRead: 1 });
notificationSchema.index({ relatedId: 1, relatedType: 1 });
notificationSchema.index({ expiresAt: 1 });
notificationSchema.index({ batchId: 1 });

// TTL index for automatic deletion of expired notifications
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Pre-save middleware to validate recipient
notificationSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const recipient = await User.findById(this.recipient);

    if (!recipient || !recipient.isActive) {
      const error = new Error('Recipient not found or inactive');
      error.status = 404;
      return next(error);
    }

    // Validate related entity if provided
    if (this.relatedId && this.relatedType) {
      let Model;
      switch (this.relatedType) {
        case 'order':
          Model = mongoose.model('Order');
          break;
        case 'message':
          Model = mongoose.model('Message');
          break;
        case 'service':
          Model = mongoose.model('Service');
          break;
        case 'user':
          Model = mongoose.model('User');
          break;
        case 'withdrawal':
          Model = mongoose.model('WithdrawRequest');
          break;
        case 'review':
          Model = mongoose.model('Review');
          break;
        default:
          const error = new Error('Invalid related type');
          error.status = 400;
          return next(error);
      }

      const entity = await Model.findById(this.relatedId);
      if (!entity) {
        const error = new Error(`${this.relatedType} not found`);
        error.status = 404;
        return next(error);
      }
    }
  }

  // Update read timestamp
  if (this.isModified('isRead') && this.isRead && !this.readAt) {
    this.readAt = new Date();
  }

  // Update push sent timestamp
  if (this.isModified('isPushSent') && this.isPushSent && !this.pushSentAt) {
    this.pushSentAt = new Date();
  }

  // Update email sent timestamp
  if (this.isModified('isEmailSent') && this.isEmailSent && !this.emailSentAt) {
    this.emailSentAt = new Date();
  }

  next();
});

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  return notification.save();
};

// Static method to get user notifications
notificationSchema.statics.getUserNotifications = function(userId, options = {}) {
  const { page = 1, limit = 20, type, isRead, category } = options;
  const query = { recipient: userId };

  if (type) {
    query.type = type;
  }

  if (typeof isRead === 'boolean') {
    query.isRead = isRead;
  }

  if (category) {
    query.category = category;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('metadata.sender', 'fullName avatar')
    .sort({ priority: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get unread count
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({
    recipient: userId,
    isRead: false
  });
};

// Static method to mark all as read
notificationSchema.statics.markAllAsRead = function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    {
      isRead: true,
      readAt: new Date()
    }
  );
};

// Static method to create bulk notifications
notificationSchema.statics.createBulkNotifications = async function(recipients, data) {
  const notifications = recipients.map(recipient => ({
    ...data,
    recipient: recipient._id || recipient,
    batchId: data.batchId || `BATCH-${Date.now()}`
  }));

  return this.insertMany(notifications);
};

// Static method to get notification statistics
notificationSchema.statics.getStatistics = function(options = {}) {
  const { userId, startDate, endDate } = options;
  const matchStage = {};

  if (userId) {
    matchStage.recipient = mongoose.Types.ObjectId(userId);
  }

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: {
          type: '$type',
          category: '$category',
          isRead: '$isRead'
        },
        count: { $sum: 1 },
        uniqueUsers: { $addToSet: '$recipient' }
      }
    },
    {
      $group: {
        _id: '$_id.type',
        total: { $sum: '$count' },
        read: {
          $sum: {
            $cond: [{ $eq: ['$_id.isRead', true] }, '$count', 0]
          }
        },
        unread: {
          $sum: {
            $cond: [{ $eq: ['$_id.isRead', false] }, '$count', 0]
          }
        },
        uniqueUsers: { $size: { $setUnion: '$uniqueUsers' } }
      }
    },
    { $sort: { total: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    return this.save();
  }
  return Promise.resolve(this);
};

// Instance method to mark push as sent
notificationSchema.methods.markPushAsSent = function() {
  this.isPushSent = true;
  this.pushSentAt = new Date();
  return this.save();
};

// Instance method to mark email as sent
notificationSchema.methods.markEmailAsSent = function() {
  this.isEmailSent = true;
  this.emailSentAt = new Date();
  return this.save();
};

// Instance method to get localized content
notificationSchema.methods.getLocalizedContent = function(locale = 'en') {
  if (locale === 'en' || !this.localization.titleTranslations.has(locale)) {
    return {
      title: this.title,
      message: this.message
    };
  }

  return {
    title: this.localization.titleTranslations.get(locale) || this.title,
    message: this.localization.messageTranslations.get(locale) || this.message
  };
};

// Instance method to isExpired
notificationSchema.methods.isExpired = function() {
  return this.expiresAt && new Date() > this.expiresAt;
};

module.exports = mongoose.model('Notification', notificationSchema);