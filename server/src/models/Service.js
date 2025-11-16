const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Service title is required'],
    trim: true,
    minlength: [10, 'Title must be at least 10 characters'],
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Service description is required'],
    trim: true,
    minlength: [50, 'Description must be at least 50 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Provider is required']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [100, 'Price must be at least NPR 100'],
    max: [100000, 'Price cannot exceed NPR 100,000']
  },
  images: [{
    type: String,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Please provide valid image URLs'
    }
  }],
  tags: [{
    type: String,
    trim: true,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isApproved: {
    type: Boolean,
    default: false
  },
  featured: {
    type: Boolean,
    default: false
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: null
    },
    coordinates: {
      type: [Number],
      default: null
    }
  },
  deliveryTime: {
    type: Number,
    required: [true, 'Delivery time is required'],
    min: [1, 'Delivery time must be at least 1 day'],
    max: [30, 'Delivery time cannot exceed 30 days']
  },
  revisions: {
    type: Number,
    default: 0,
    min: [0, 'Revisions cannot be negative'],
    max: [10, 'Revisions cannot exceed 10']
  },
  requirements: {
    type: String,
    maxlength: [1000, 'Requirements cannot exceed 1000 characters'],
    default: ''
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  orderCount: {
    type: Number,
    default: 0,
    min: 0
  },
  viewCount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalRevenue: {
    type: Number,
    default: 0,
    min: 0
  },
  lastOrderDate: {
    type: Date,
    default: null
  },
  responseTime: {
    type: Number,
    default: null,
    min: 0
  },
  availability: {
    type: String,
    enum: ['available', 'busy', 'unavailable'],
    default: 'available'
  },
  seoTitle: {
    type: String,
    maxlength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
serviceSchema.index({ category: 1, isActive: 1 });
serviceSchema.index({ provider: 1, isActive: 1 });
serviceSchema.index({ featured: 1, isActive: 1 });
serviceSchema.index({ price: 1, isActive: 1 });
serviceSchema.index({ rating: -1, isActive: 1 });
serviceSchema.index({ location: '2dsphere' });
serviceSchema.index({ tags: 1 });
serviceSchema.index({ title: 'text', description: 'text', tags: 'text' });

// Virtual for reviews
serviceSchema.virtual('reviews', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'service'
});

// Virtual for orders
serviceSchema.virtual('orders', {
  ref: 'Order',
  localField: '_id',
  foreignField: 'service'
});

// Pre-save middleware to validate provider is a seller
serviceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const provider = await User.findById(this.provider);
    if (!provider || !provider.isSeller) {
      const error = new Error('Provider must be a registered seller');
      error.status = 400;
      return next(error);
    }
    if (!provider.isActive) {
      const error = new Error('Provider account is not active');
      error.status = 400;
      return next(error);
    }
  }
  next();
});

// Pre-remove middleware to clean up related data
serviceSchema.pre('remove', async function(next) {
  // Remove all orders for this service
  await mongoose.model('Order').deleteMany({ service: this._id });

  // Remove all reviews for this service
  await mongoose.model('Review').deleteMany({ service: this._id });

  next();
});

// Static method to get featured services
serviceSchema.statics.getFeaturedServices = function(limit = 10) {
  return this.find({ featured: true, isActive: true, isApproved: true })
    .populate('provider', 'fullName avatar averageRating')
    .populate('category', 'name')
    .sort({ rating: -1, orderCount: -1 })
    .limit(limit);
};

// Static method to search services
serviceSchema.statics.searchServices = function(query, options = {}) {
  const {
    category,
    minPrice,
    maxPrice,
    sortBy = 'relevance',
    page = 1,
    limit = 20
  } = options;

  const searchQuery = {
    isActive: true,
    isApproved: true
  };

  // Text search
  if (query) {
    searchQuery.$text = { $search: query };
  }

  // Category filter
  if (category) {
    searchQuery.category = category;
  }

  // Price range filter
  if (minPrice || maxPrice) {
    searchQuery.price = {};
    if (minPrice) searchQuery.price.$gte = minPrice;
    if (maxPrice) searchQuery.price.$lte = maxPrice;
  }

  // Sorting
  let sortOptions = {};
  switch (sortBy) {
    case 'price_low':
      sortOptions = { price: 1 };
      break;
    case 'price_high':
      sortOptions = { price: -1 };
      break;
    case 'rating':
      sortOptions = { rating: -1 };
      break;
    case 'newest':
      sortOptions = { createdAt: -1 };
      break;
    case 'orders':
      sortOptions = { orderCount: -1 };
      break;
    default:
      sortOptions = query ? { score: { $meta: 'textScore' } } : { rating: -1 };
  }

  const skip = (page - 1) * limit;

  return this.find(searchQuery)
    .populate('provider', 'fullName avatar averageRating')
    .populate('category', 'name')
    .sort(sortOptions)
    .skip(skip)
    .limit(limit);
};

// Instance method to update rating
serviceSchema.methods.updateRating = async function() {
  const Review = mongoose.model('Review');
  const stats = await Review.aggregate([
    { $match: { service: this._id } },
    {
      $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        count: { $sum: 1 }
      }
    }
  ]);

  this.rating = stats[0]?.avgRating || 0;
  this.reviewCount = stats[0]?.count || 0;
  return this.save();
};

// Instance method to increment order count
serviceSchema.methods.incrementOrderCount = function() {
  this.orderCount += 1;
  this.lastOrderDate = new Date();
  return this.save();
};

module.exports = mongoose.model('Service', serviceSchema);