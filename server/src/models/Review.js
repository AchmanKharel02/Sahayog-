const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: [true, 'Order is required']
  },
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service is required']
  },
  reviewer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewer is required']
  },
  reviewee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Reviewee is required']
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: [1, 'Rating must be at least 1'],
    max: [5, 'Rating cannot exceed 5']
  },
  comment: {
    type: String,
    required: [true, 'Review comment is required'],
    trim: true,
    minlength: [10, 'Comment must be at least 10 characters'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  aspects: {
    communication: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    quality: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    delivery: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    value: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    }
  },
  isRecommended: {
    type: Boolean,
    default: null
  },
  response: {
    content: {
      type: String,
      maxlength: [1000, 'Response cannot exceed 1000 characters']
    },
    respondedAt: {
      type: Date,
      default: null
    }
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  reportCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date,
    default: null
  },
  helpfulVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  totalVotes: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
reviewSchema.index({ service: 1, createdAt: -1 });
reviewSchema.index({ reviewer: 1, createdAt: -1 });
reviewSchema.index({ reviewee: 1, createdAt: -1 });
reviewSchema.index({ order: 1 });
reviewSchema.index({ rating: -1 });
reviewSchema.index({ isHidden: 1, createdAt: -1 });

// Unique index to prevent duplicate reviews
reviewSchema.index({ order: 1, reviewer: 1 }, { unique: true });

// Pre-save middleware to validate order completion
reviewSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Order = mongoose.model('Order');
    const order = await Order.findById(this.order);

    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      return next(error);
    }

    if (order.status !== 'completed') {
      const error = new Error('Reviews can only be added to completed orders');
      error.status = 400;
      return next(error);
    }

    // Check if reviewer is the buyer
    if (order.buyer.toString() !== this.reviewer.toString()) {
      const error = new Error('Only buyers can write reviews');
      error.status = 403;
      return next(error);
    }

    // Set reviewee as seller
    this.reviewee = order.seller;

    // Check if review already exists
    const existingReview = await this.constructor.findOne({
      order: this.order,
      reviewer: this.reviewer
    });

    if (existingReview) {
      const error = new Error('Review already exists for this order');
      error.status = 400;
      return next(error);
    }
  }
  next();
});

// Pre-save middleware to update service and user ratings
reviewSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('rating')) {
    const Service = mongoose.model('Service');
    const User = mongoose.model('User');

    // Update service rating
    await Service.findByIdAndUpdate(this.service, { $inc: { reviewCount: 1 } });

    const service = await Service.findById(this.service);
    if (service) {
      await service.updateRating();
    }

    // Update seller rating
    await User.findByIdAndUpdate(this.reviewee, { $inc: { totalReviews: 1 } });

    // Calculate user's new average rating
    const userStats = await this.constructor.aggregate([
      { $match: { reviewee: this.reviewee } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          count: { $sum: 1 }
        }
      }
    ]);

    if (userStats[0]) {
      await User.findByIdAndUpdate(this.reviewee, {
        averageRating: userStats[0].avgRating,
        totalReviews: userStats[0].count
      });
    }
  }
  next();
});

// Pre-remove middleware to update ratings
reviewSchema.pre('remove', async function(next) {
  const Service = mongoose.model('Service');
  const User = mongoose.model('User');

  // Update service
  const service = await Service.findById(this.service);
  if (service) {
    service.reviewCount = Math.max(0, service.reviewCount - 1);
    await service.updateRating();
  }

  // Update user
  const user = await User.findById(this.reviewee);
  if (user) {
    user.totalReviews = Math.max(0, user.totalReviews - 1);

    // Recalculate average rating
    const userStats = await this.constructor.aggregate([
      { $match: { reviewee: this.reviewee } },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' }
        }
      }
    ]);

    user.averageRating = userStats[0]?.avgRating || 0;
    await user.save();
  }
  next();
});

// Static method to get service reviews
reviewSchema.statics.getServiceReviews = function(serviceId, options = {}) {
  const { page = 1, limit = 20, rating } = options;
  const query = { service: serviceId, isHidden: false };

  if (rating) {
    query.rating = rating;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('reviewer', 'fullName avatar')
    .populate('reviewee', 'fullName')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get user reviews
reviewSchema.statics.getUserReviews = function(userId, role = 'reviewee', options = {}) {
  const { page = 1, limit = 20, rating } = options;
  const query = { [role]: userId, isHidden: false };

  if (rating) {
    query.rating = rating;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('reviewer', 'fullName avatar')
    .populate('service', 'title')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Instance method to mark as helpful
reviewSchema.methods.markHelpful = function() {
  this.helpfulVotes += 1;
  this.totalVotes += 1;
  return this.save();
};

// Instance method to edit review
reviewSchema.methods.editReview = function(newRating, newComment) {
  this.rating = newRating;
  this.comment = newComment;
  this.isEdited = true;
  this.editedAt = new Date();
  return this.save();
};

// Instance method to add response
reviewSchema.methods.addResponse = function(responseContent) {
  this.response = {
    content: responseContent,
    respondedAt: new Date()
  };
  return this.save();
};

module.exports = mongoose.model('Review', reviewSchema);