const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: [0, 'Balance cannot be negative']
  },
  currency: {
    type: String,
    default: 'NPR',
    enum: {
      values: ['NPR', 'USD', 'EUR'],
      message: 'Invalid currency'
    }
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  frozenReason: {
    type: String,
    maxlength: [500, 'Freeze reason cannot exceed 500 characters'],
    default: ''
  },
  frozenAt: {
    type: Date,
    default: null
  },
  totalEarnings: {
    type: Number,
    default: 0,
    min: 0
  },
  totalWithdrawals: {
    type: Number,
    default: 0,
    min: 0
  },
  totalSpent: {
    type: Number,
    default: 0,
    min: 0
  },
  lastTransactionAt: {
    type: Date,
    default: null
  },
  withdrawalInfo: {
    bankName: {
      type: String,
      maxlength: [100, 'Bank name cannot exceed 100 characters']
    },
    accountNumber: {
      type: String,
      maxlength: [50, 'Account number cannot exceed 50 characters']
    },
    accountName: {
      type: String,
      maxlength: [100, 'Account name cannot exceed 100 characters']
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verifiedAt: {
      type: Date,
      default: null
    }
  },
  dailyLimit: {
    type: Number,
    default: 100000,
    min: 0
  },
  monthlyLimit: {
    type: Number,
    default: 1000000,
    min: 0
  },
  stats: {
    dailySpent: {
      type: Number,
      default: 0,
      min: 0
    },
    monthlySpent: {
      type: Number,
      default: 0,
      min: 0
    },
    lastDailyReset: {
      type: Date,
      default: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), now.getDate());
      }
    },
    lastMonthlyReset: {
      type: Date,
      default: () => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
      }
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
walletSchema.index({ user: 1 });
walletSchema.index({ isFrozen: 1 });
walletSchema.index({ balance: 1 });

// Virtual for transactions
walletSchema.virtual('transactions', {
  ref: 'Transaction',
  localField: '_id',
  foreignField: 'wallet',
  options: { sort: { createdAt: -1 } }
});

// Virtual for withdrawal requests
walletSchema.virtual('withdrawalRequests', {
  ref: 'WithdrawRequest',
  localField: '_id',
  foreignField: 'wallet',
  options: { sort: { createdAt: -1 } }
});

// Pre-save middleware to validate user and reset spending limits
walletSchema.pre('save', async function(next) {
  if (this.isNew) {
    const User = mongoose.model('User');
    const user = await User.findById(this.user);

    if (!user) {
      const error = new Error('User not found');
      error.status = 404;
      return next(error);
    }
  }

  // Reset daily and monthly spending limits
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  if (this.stats.lastDailyReset < today) {
    this.stats.dailySpent = 0;
    this.stats.lastDailyReset = today;
  }

  if (this.stats.lastMonthlyReset < thisMonth) {
    this.stats.monthlySpent = 0;
    this.stats.lastMonthlyReset = thisMonth;
  }

  next();
});

// Instance method to add balance
walletSchema.methods.addBalance = async function(amount, description, type = 'deposit', relatedId = null) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (this.isFrozen) {
    throw new Error('Wallet is frozen');
  }

  const Transaction = mongoose.model('Transaction');

  const transaction = new Transaction({
    wallet: this._id,
    type: type,
    amount: amount,
    balance: this.balance + amount,
    description: description,
    status: 'completed',
    relatedId: relatedId
  });

  await transaction.save();

  this.balance += amount;
  this.totalEarnings += amount;
  this.lastTransactionAt = new Date();

  return this.save();
};

// Instance method to deduct balance
walletSchema.methods.deductBalance = async function(amount, description, type = 'payment', relatedId = null) {
  if (amount <= 0) {
    throw new Error('Amount must be positive');
  }

  if (this.isFrozen) {
    throw new Error('Wallet is frozen');
  }

  if (this.balance < amount) {
    throw new Error('Insufficient balance');
  }

  // Check spending limits
  if (this.stats.dailySpent + amount > this.dailyLimit) {
    throw new Error('Daily spending limit exceeded');
  }

  if (this.stats.monthlySpent + amount > this.monthlyLimit) {
    throw new Error('Monthly spending limit exceeded');
  }

  const Transaction = mongoose.model('Transaction');

  const transaction = new Transaction({
    wallet: this._id,
    type: type,
    amount: -amount,
    balance: this.balance - amount,
    description: description,
    status: 'completed',
    relatedId: relatedId
  });

  await transaction.save();

  this.balance -= amount;
  this.totalSpent += amount;
  this.stats.dailySpent += amount;
  this.stats.monthlySpent += amount;
  this.lastTransactionAt = new Date();

  return this.save();
};

// Instance method to freeze wallet
walletSchema.methods.freeze = function(reason) {
  this.isFrozen = true;
  this.frozenReason = reason;
  this.frozenAt = new Date();
  return this.save();
};

// Instance method to unfreeze wallet
walletSchema.methods.unfreeze = function() {
  this.isFrozen = false;
  this.frozenReason = '';
  this.frozenAt = null;
  return this.save();
};

// Instance method to check available balance
walletSchema.methods.getAvailableBalance = function() {
  return this.isFrozen ? 0 : this.balance;
};

// Instance method to check if can spend
walletSchema.methods.canSpend = function(amount) {
  if (this.isFrozen) return false;
  if (this.balance < amount) return false;
  if (this.stats.dailySpent + amount > this.dailyLimit) return false;
  if (this.stats.monthlySpent + amount > this.monthlyLimit) return false;
  return true;
};

// Static method to get wallet by user
walletSchema.statics.getByUser = function(userId) {
  return this.findOne({ user: userId }).populate('user', 'fullName email');
};

// Static method to get wallet statistics
walletSchema.statics.getStatistics = function() {
  const pipeline = [
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalEarnings: { $sum: '$totalEarnings' },
        totalSpent: { $sum: '$totalSpent' },
        activeWallets: {
          $sum: { $cond: [{ $eq: ['$isFrozen', false] }, 1, 0] }
        },
        frozenWallets: {
          $sum: { $cond: [{ $eq: ['$isFrozen', true] }, 1, 0] }
        },
        avgBalance: { $avg: '$balance' }
      }
    }
  ];

  return this.aggregate(pipeline);
};

module.exports = mongoose.model('Wallet', walletSchema);