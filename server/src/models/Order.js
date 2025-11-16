const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service is required']
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Buyer is required']
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'accepted', 'in_progress', 'delivered', 'completed', 'cancelled', 'disputed'],
      message: 'Invalid order status'
    },
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [100, 'Amount must be at least NPR 100']
  },
  commissionAmount: {
    type: Number,
    required: [true, 'Commission amount is required'],
    min: [0, 'Commission cannot be negative']
  },
  sellerEarnings: {
    type: Number,
    required: [true, 'Seller earnings is required'],
    min: [0, 'Seller earnings cannot be negative']
  },
  requirements: {
    type: String,
    maxlength: [2000, 'Requirements cannot exceed 2000 characters'],
    default: ''
  },
  deliveryFiles: [{
    filename: String,
    url: String,
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  completionDate: {
    type: Date,
    default: null
  },
  expectedDeliveryDate: {
    type: Date,
    required: [true, 'Expected delivery date is required']
  },
  acceptedAt: {
    type: Date,
    default: null
  },
  inProgressAt: {
    type: Date,
    default: null
  },
  deliveredAt: {
    type: Date,
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  cancelledAt: {
    type: Date,
    default: null
  },
  cancellationReason: {
    type: String,
    maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
    default: ''
  },
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  disputeReason: {
    type: String,
    maxlength: [1000, 'Dispute reason cannot exceed 1000 characters'],
    default: ''
  },
  disputeDetails: {
    type: String,
    maxlength: [2000, 'Dispute details cannot exceed 2000 characters'],
    default: ''
  },
  disputedAt: {
    type: Date,
    default: null
  },
  disputeResolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  disputeResolution: {
    type: String,
    enum: ['refund_to_buyer', 'release_to_seller', 'partial_refund', 'cancelled'],
    default: null
  },
  disputeResolvedAt: {
    type: Date,
    default: null
  },
  notes: [{
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    content: {
      type: String,
      required: true,
      maxlength: [500, 'Note cannot exceed 500 characters']
    },
    isInternal: {
      type: Boolean,
      default: false
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  revisionRequests: [{
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    reason: {
      type: String,
      required: true,
      maxlength: [1000, 'Revision reason cannot exceed 1000 characters']
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'completed'],
      default: 'pending'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    respondedAt: {
      type: Date,
      default: null
    }
  }],
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded', 'partial_refund'],
    default: 'pending'
  },
  paidAt: {
    type: Date,
    default: null
  },
  refundedAt: {
    type: Date,
    default: null
  },
  refundAmount: {
    type: Number,
    default: null,
    min: [0, 'Refund amount cannot be negative']
  },
  trackingCode: {
    type: String,
    unique: true,
    required: true,
    default: () => 'ORD-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase()
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ seller: 1, createdAt: -1 });
orderSchema.index({ service: 1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ trackingCode: 1 });
orderSchema.index({ paymentStatus: 1 });
orderSchema.index({ expectedDeliveryDate: 1 });

// Virtual for reviews
orderSchema.virtual('review', {
  ref: 'Review',
  localField: '_id',
  foreignField: 'order',
  justOne: true
});

// Virtual for messages
orderSchema.virtual('messages', {
  ref: 'Message',
  localField: '_id',
  foreignField: 'orderId',
  options: { sort: { sentAt: 1 } }
});

// Pre-save middleware to validate service and calculate commission
orderSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Service = mongoose.model('Service');
    const User = mongoose.model('User');

    const service = await Service.findById(this.service);
    if (!service || !service.isActive) {
      const error = new Error('Service is not available');
      error.status = 400;
      return next(error);
    }

    const buyer = await User.findById(this.buyer);
    const seller = await User.findById(this.seller);

    if (!buyer || !buyer.isActive) {
      const error = new Error('Buyer account is not active');
      error.status = 400;
      return next(error);
    }

    if (!seller || !seller.isSeller || !seller.isActive) {
      const error = new Error('Seller is not available');
      error.status = 400;
      return next(error);
    }

    if (buyer._id.toString() === seller._id.toString()) {
      const error = new Error('Buyer and seller cannot be the same person');
      error.status = 400;
      return next(error);
    }

    // Calculate commission
    const commissionRate = process.env.COMMISSION_RATE || 0.10;
    this.commissionAmount = Math.round(this.totalAmount * commissionRate);
    this.sellerEarnings = this.totalAmount - this.commissionAmount;

    // Set expected delivery date if not provided
    if (!this.expectedDeliveryDate) {
      this.expectedDeliveryDate = new Date(Date.now() + (service.deliveryTime * 24 * 60 * 60 * 1000));
    }
  }
  next();
});

// Instance method to update status
orderSchema.methods.updateStatus = function(newStatus, updatedBy = null) {
  const statusTransitions = {
    pending: ['accepted', 'cancelled'],
    accepted: ['in_progress', 'cancelled'],
    in_progress: ['delivered', 'cancelled'],
    delivered: ['completed', 'cancelled'],
    completed: [], // Final state
    cancelled: [], // Final state
    disputed: ['cancelled'] // Can be cancelled after dispute resolution
  };

  if (!statusTransitions[this.status]?.includes(newStatus)) {
    throw new Error(`Cannot change status from ${this.status} to ${newStatus}`);
  }

  this.status = newStatus;

  // Set timestamps
  const now = new Date();
  switch (newStatus) {
    case 'accepted':
      this.acceptedAt = now;
      break;
    case 'in_progress':
      this.inProgressAt = now;
      break;
    case 'delivered':
      this.deliveredAt = now;
      break;
    case 'completed':
      this.completedAt = now;
      this.completionDate = now;
      break;
    case 'cancelled':
      this.cancelledAt = now;
      this.cancelledBy = updatedBy;
      break;
    case 'disputed':
      this.disputedAt = now;
      break;
  }
};

// Static method to get orders by user
orderSchema.statics.getUserOrders = function(userId, role = 'all', options = {}) {
  const { page = 1, limit = 20, status } = options;
  const query = {};

  if (role === 'buyer') {
    query.buyer = userId;
  } else if (role === 'seller') {
    query.seller = userId;
  } else {
    query.$or = [{ buyer: userId }, { seller: userId }];
  }

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('service', 'title images category')
    .populate('buyer', 'fullName avatar')
    .populate('seller', 'fullName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get orders by status
orderSchema.statics.getOrdersByStatus = function(status, options = {}) {
  const { page = 1, limit = 20 } = options;
  const skip = (page - 1) * limit;

  return this.find({ status })
    .populate('service', 'title')
    .populate('buyer', 'fullName avatar')
    .populate('seller', 'fullName avatar')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

module.exports = mongoose.model('Order', orderSchema);