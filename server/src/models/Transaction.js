const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  wallet: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: [true, 'Wallet is required']
  },
  type: {
    type: String,
    enum: {
      values: [
        'deposit',
        'withdrawal',
        'payment',
        'refund',
        'earning',
        'commission',
        'bonus',
        'penalty',
        'chargeback',
        'transfer_in',
        'transfer_out',
        'adjustment'
      ],
      message: 'Invalid transaction type'
    },
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  balance: {
    type: Number,
    required: [true, 'Balance is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  status: {
    type: String,
    enum: {
      values: ['pending', 'completed', 'failed', 'cancelled', 'reversed'],
      message: 'Invalid transaction status'
    },
    default: 'pending'
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  relatedType: {
    type: String,
    enum: ['order', 'withdrawal', 'deposit', 'refund', 'adjustment', 'bonus', 'penalty'],
    default: null
  },
  reference: {
    type: String,
    unique: true,
    sparse: true,
    default: () => 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase()
  },
  metadata: {
    gateway: {
      type: String,
      enum: ['esewa', 'khalti', 'imepay', 'bank_transfer', 'cash', 'system', 'admin'],
      default: 'system'
    },
    gatewayTransactionId: {
      type: String,
      maxlength: [100, 'Gateway transaction ID cannot exceed 100 characters']
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    ipAddress: String,
    userAgent: String,
    deviceType: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop'],
      default: null
    }
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
  scheduledFor: {
    type: Date,
    default: null
  },
  processedAt: {
    type: Date,
    default: null
  },
  failedAt: {
    type: Date,
    default: null
  },
  failureReason: {
    type: String,
    maxlength: [500, 'Failure reason cannot exceed 500 characters'],
    default: ''
  },
  reversalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Transaction',
    default: null
  },
  reversedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reversalReason: {
    type: String,
    maxlength: [500, 'Reversal reason cannot exceed 500 characters'],
    default: ''
  },
  reversedAt: {
    type: Date,
    default: null
  },
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters'],
    default: ''
  },
  isInternal: {
    type: Boolean,
    default: false
  },
  tags: [{
    type: String,
    maxlength: [30, 'Tag cannot exceed 30 characters']
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
transactionSchema.index({ wallet: 1, createdAt: -1 });
transactionSchema.index({ type: 1, status: 1, createdAt: -1 });
transactionSchema.index({ reference: 1 });
transactionSchema.index({ relatedId: 1, relatedType: 1 });
transactionSchema.index({ status: 1, scheduledFor: 1 });
transactionSchema.index({ 'metadata.gateway': 1 });
transactionSchema.index({ amount: 1 });
transactionSchema.index({ reversalId: 1 });

// Pre-save middleware to generate reference if not provided
transactionSchema.pre('save', function(next) {
  if (!this.reference) {
    this.reference = 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8).toUpperCase();
  }
  next();
});

// Pre-save middleware to validate wallet balance
transactionSchema.pre('save', async function(next) {
  if (this.isNew || this.isModified('amount') || this.isModified('status')) {
    const Wallet = mongoose.model('Wallet');
    const wallet = await Wallet.findById(this.wallet);

    if (!wallet) {
      const error = new Error('Wallet not found');
      error.status = 404;
      return next(error);
    }

    if (this.status === 'completed' && this.amount < 0 && Math.abs(this.amount) > wallet.balance) {
      const error = new Error('Insufficient wallet balance');
      error.status = 400;
      return next(error);
    }

    // Set processed timestamp
    if (this.isModified('status') && this.status === 'completed' && !this.processedAt) {
      this.processedAt = new Date();
    }

    if (this.isModified('status') && this.status === 'failed' && !this.failedAt) {
      this.failedAt = new Date();
    }
  }
  next();
});

// Post-save middleware to update wallet balance
transactionSchema.post('save', async function(doc) {
  if (doc.isNew || doc.isModified('status')) {
    const Wallet = mongoose.model('Wallet');

    if (doc.status === 'completed' && !doc.reversalId) {
      await Wallet.findByIdAndUpdate(
        doc.wallet,
        {
          $inc: { balance: doc.amount },
          lastTransactionAt: new Date()
        }
      );
    }
  }
});

// Static method to get wallet transactions
transactionSchema.statics.getWalletTransactions = function(walletId, options = {}) {
  const { page = 1, limit = 50, type, status, startDate, endDate } = options;
  const query = { wallet: walletId };

  if (type) {
    query.type = type;
  }

  if (status) {
    query.status = status;
  }

  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('relatedId', 'title trackingCode')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get transactions by type
transactionSchema.statics.getTransactionsByType = function(type, options = {}) {
  const { page = 1, limit = 20, status } = options;
  const query = { type };

  if (status) {
    query.status = status;
  }

  const skip = (page - 1) * limit;

  return this.find(query)
    .populate('wallet', 'user balance')
    .populate('wallet.user', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Static method to get pending transactions
transactionSchema.statics.getPendingTransactions = function() {
  return this.find({ status: 'pending' })
    .populate('wallet', 'user balance')
    .populate('wallet.user', 'fullName email')
    .sort({ createdAt: 1 });
};

// Static method to get transaction statistics
transactionSchema.statics.getStatistics = function(options = {}) {
  const { startDate, endDate, type } = options;
  const matchStage = {};

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = new Date(startDate);
    if (endDate) matchStage.createdAt.$lte = new Date(endDate);
  }

  if (type) {
    matchStage.type = type;
  }

  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$type',
        totalAmount: { $sum: '$amount' },
        totalTransactions: { $sum: 1 },
        completedAmount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, '$amount', 0]
          }
        },
        completedTransactions: {
          $sum: {
            $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
          }
        }
      }
    },
    { $sort: { totalAmount: -1 } }
  ];

  return this.aggregate(pipeline);
};

// Instance method to mark as completed
transactionSchema.methods.markAsCompleted = function() {
  this.status = 'completed';
  this.processedAt = new Date();
  return this.save();
};

// Instance method to mark as failed
transactionSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failedAt = new Date();
  this.failureReason = reason;
  return this.save();
};

// Instance method to reverse transaction
transactionSchema.methods.reverse = async function(reason, reversedBy) {
  const reversalTransaction = new this.constructor({
    wallet: this.wallet,
    type: this.type === 'payment' ? 'refund' : 'adjustment',
    amount: -this.amount,
    balance: this.balance + this.amount,
    description: `Reversal of transaction ${this.reference}: ${reason}`,
    status: 'completed',
    reversalId: this._id,
    reversedBy: reversedBy,
    reversalReason: reason,
    metadata: this.metadata,
    processedAt: new Date()
  });

  await reversalTransaction.save();

  this.reversedAt = new Date();
  this.reversalReason = reason;
  this.reversedBy = reversedBy;

  return this.save();
};

module.exports = mongoose.model('Transaction', transactionSchema);