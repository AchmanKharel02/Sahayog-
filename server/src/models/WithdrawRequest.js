const mongoose = require('mongoose');

const withdrawRequestSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet is required']
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [process.env.MIN_WITHDRAWAL || 500, `Minimum withdrawal amount is NPR ${process.env.MIN_WITHDRAWAL || 500}`]
  },
  method: {
    type: String,
    enum: {
      values: ['bank_transfer', 'esewa', 'khalti', 'imepay'],
      message: 'Invalid withdrawal method'
    },
    required: [true, 'Withdrawal method is required']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled'],
      message: 'Invalid withdrawal status'
    },
    default: 'pending'
  },
  bankDetails: {
    bankName: {
      type: String,
      required: function() {
        return this.method === 'bank_transfer';
      },
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    accountNumber: {
      type: String,
      required: function() {
        return this.method === 'bank_transfer';
      },
      maxlength: [50, 'Account number cannot exceed 50 characters']
    },
    accountName: {
      type: String,
      required: function() {
        return this.method === 'bank_transfer';
      },
      maxlength: [100, 'Account name cannot exceed 100 characters']
    },
    branch: {
      type: String,
      maxlength: [100, 'Branch name cannot exceed 100 characters']
    }
  },
  mobileDetails: {
    number: {
      type: String,
      required: function() {
        return ['esewa', 'khalti', 'imepay'].includes(this.method);
      },
      match: [/^(97|98)\d{8}$/, 'Please enter a valid Nepali mobile number']
    },
    provider: {
      type: String,
      enum: ['ntc', 'ncell'],
      required: function() {
        return ['esewa', 'khalti', 'imepay'].includes(this.method);
      }
    }
  },
  reference: {
    type: String,
    unique: true,
    required: true,
    default: () => 'WDR-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6).toUpperCase()
  },
  transactionId: {
    type: String,
    maxlength: [100, 'Transaction ID cannot exceed 100 characters']
  },
  processingFees: {
    type: Number,
    default: 0,
    min: 0
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  netAmount: {
    type: Number,
    default: function() {
      return this.amount - this.processingFees - this.taxAmount;
    }
  },
  reason: {
    type: String,
    maxlength: [500, 'Reason cannot exceed 500 characters'],
    default: ''
  },
  rejectionReason: {
    type: String,
    maxlength: [1000, 'Rejection reason cannot exceed 1000 characters'],
    default: ''
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: ''
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  approvedAt: {
    type: Date,
    default: null
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  rejectedAt: {
    type: Date,
    default: null
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  completedAt: {
    type: Date,
    default: null
  },
  expectedCompletionDate: {
    type: Date,
    default: function() {
      // Default to 3 business days from now
      const date = new Date();
      let businessDays = 3;

      while (businessDays > 0) {
        date.setDate(date.getDate() + 1);
        const dayOfWeek = date.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Saturday or Sunday
          businessDays--;
        }
      }

      return date;
    }
  },
  attachments: [{
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  ipAddress: String,
  userAgent: String,
  priority: {
    type: String,
    enum: ['normal', 'urgent', 'low'],
    default: 'normal'
  },
  isUrgent: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
withdrawRequestSchema.index({ user: 1, createdAt: -1 });
withdrawRequestSchema.index({ wallet: 1, createdAt: -1 });
withdrawRequestSchema.index({ status: 1, createdAt: -1 });
withdrawRequestSchema.index({ method: 1, status: 1 });
withdrawRequestSchema.index({ reference: 1 });
withdrawRequestSchema.index({ expectedCompletionDate: 1 });
withdrawRequestSchema.index({ isUrgent: 1, status: 1 });

// Pre-save middleware to validate wallet balance and user
withdrawRequestSchema.pre('save', async function(next) {
  if (this.isNew) {
    const Wallet = mongoose.model('Wallet');
    const User = mongoose.model('User');

    const wallet = await Wallet.findById(this.wallet).populate('user');
    const user = await User.findById(this.user);

    if (!wallet || !user) {
      const error = new Error('Wallet or user not found');
      error.status = 404;
      return next(error);
    }

    if (wallet.user.toString() !== this.user.toString()) {
      const error = new Error('Wallet does not belong to this user');
      error.status = 400;
      return next(error);
    }

    if (!user.isSeller) {
      const error = new Error('Only sellers can request withdrawals');
      error.status = 400;
      return next(error);
    }

    if (wallet.isFrozen) {
      const error = new Error('Wallet is frozen');
      error.status = 400;
      return next(error);
    }

    if (wallet.balance < this.amount) {
      const error = new Error('Insufficient wallet balance');
      error.status = 400;
      return next(error);
    }

    // Check for existing pending withdrawals
    const existingPending = await this.constructor.findOne({
      wallet: this.wallet,
      status: { $in: ['pending', 'processing'] }
    });

    if (existingPending) {
      const error = new Error('You already have a pending withdrawal request');
      error.status = 400;
      return next(error);
    }

    // Validate withdrawal details based on method
    if (this.method === 'bank_transfer') {
      if (!this.bankDetails.bankName || !this.bankDetails.accountNumber || !this.bankDetails.accountName) {
        const error = new Error('All bank details are required for bank transfer');
        error.status = 400;
        return next(error);
      }
    }

    if (['esewa', 'khalti', 'imepay'].includes(this.method)) {
      if (!this.mobileDetails.number || !this.mobileDetails.provider) {
        const error = new Error('Mobile number and provider are required for this method');
        error.status = 400;
        return next(error);
      }
    }
  }
  next();
});

// Pre-save middleware to set timestamps for status changes
withdrawRequestSchema.pre('save', function(next) {
  const now = new Date();

  if (this.isModified('status')) {
    switch (this.status) {
      case 'approved':
        if (!this.approvedAt) this.approvedAt = now;
        break;
      case 'rejected':
        if (!this.rejectedAt) this.rejectedAt = now;
        break;
      case 'processing':
        if (!this.processedAt) this.processedAt = now;
        break;
      case 'completed':
        if (!this.completedAt) this.completedAt = now;
        break;
    }
  }

  if (this.isModified('verificationStatus') && this.verificationStatus === 'verified') {
    this.verifiedAt = now;
  }

  next();
});

// Static method to get user withdrawal requests
withdrawRequestSchema.statics.getUserWithdrawals = function(userId, options = {}) {
  const { page = 1, limit = 20, status, method } = options;
  const query = { user: userId };

  if (status) {
    query.status = status;
  }

  if (method) {
    query.method = method;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('wallet', 'balance currency')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get withdrawal statistics
withdrawRequestSchema.statics.getStatistics = function(options = {}) {
  const { startDate, endDate } = options;
  const matchStage = {};

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$amount' },
        avgAmount: { $avg: '$amount' }
      }
    },
    { $sort: { totalAmount: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Static method to get pending withdrawals
withdrawRequestSchema.statics.getPendingWithdrawals = function() {
  return this.find({ status: { $in: ['pending', 'processing'] } })
    .populate('user', 'fullName email')
    .populate('wallet', 'balance')
    .sort({ isUrgent: -1, createdAt: 1 });
};

// Instance method to approve withdrawal
withdrawRequestSchema.methods.approve = async function(approvedBy, notes = '') {
  const Wallet = mongoose.model('Wallet');
  const Transaction = mongoose.model('Transaction');

  this.status = 'approved';
  this.approvedAt = new Date();
  this.approvedBy = approvedBy;
  if (notes) this.notes = notes;

  // Create withdrawal transaction
  const transaction = new Transaction({
    wallet: this.wallet,
    type: 'withdrawal',
    amount: -this.amount,
    balance: null, // Will be set by wallet middleware
    description: `Withdrawal request ${this.reference} - ${this.method}`,
    status: 'pending',
    relatedId: this._id,
    relatedType: 'withdrawal',
    metadata: {
      gateway: this.method === 'bank_transfer' ? 'bank_transfer' : 'mobile_wallet'
    }
  });

  await transaction.save();
  await this.save();

  return transaction;
};

// Instance method to reject withdrawal
withdrawRequestSchema.methods.reject = function(rejectedBy, rejectionReason) {
  this.status = 'rejected';
  this.rejectedAt = new Date();
  this.rejectedBy = rejectedBy;
  this.rejectionReason = rejectionReason;
  return this.save();
};

// Instance method to mark as processing
withdrawRequestSchema.methods.markAsProcessing = function(processedBy) {
  this.status = 'processing';
  this.processedAt = new Date();
  this.processedBy = processedBy;
  return this.save();
};

// Instance method to complete withdrawal
withdrawRequestSchema.methods.complete = function(transactionId) {
  this.status = 'completed';
  this.completedAt = new Date();
  this.transactionId = transactionId;
  return this.save();
};

module.exports = mongoose.model('WithdrawRequest', withdrawRequestSchema);