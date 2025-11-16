const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WithdrawRequest = require('../models/WithdrawRequest');
const User = require('../models/User');
const Notification = require('../models/Notification');

// Get wallet details
const getWallet = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;

    const wallet = await Wallet.findOne({ user: userId })
      .populate('user', 'fullName email');

    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    // Get transactions
    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      startDate,
      endDate
    };

    const transactions = await Transaction.getWalletTransactions(wallet._id, options);

    // Get total count for pagination
    const query = { wallet: wallet._id };
    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await Transaction.countDocuments(query);

    // Get statistics
    const stats = await Transaction.aggregate([
      { $match: { wallet: wallet._id } },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        wallet,
        transactions,
        statistics: stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet'
    });
  }
};

// Add money to wallet (admin only)
const addMoney = async (req, res) => {
  try {
    const { userId, amount, description } = req.body;
    const adminId = req.userId;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'User wallet not found'
      });
    }

    await wallet.addBalance(
      amount,
      description || 'Balance added by admin',
      'deposit'
    );

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Money Added to Wallet',
      message: `NPR ${amount.toLocaleString()} has been added to your wallet.`,
      type: 'payment',
      category: 'success'
    });

    res.json({
      success: true,
      message: 'Money added successfully',
      data: {
        newBalance: wallet.balance
      }
    });
  } catch (error) {
    console.error('Add money error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add money'
    });
  }
};

// Request withdrawal
const requestWithdrawal = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      amount,
      method,
      bankDetails,
      mobileDetails,
      reason = ''
    } = req.body;

    const user = req.user;

    if (!user.isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only sellers can request withdrawals'
      });
    }

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet || wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance'
      });
    }

    // Create withdrawal request
    const withdrawal = new WithdrawRequest({
      wallet: wallet._id,
      user: userId,
      amount,
      method,
      reason,
      bankDetails: method === 'bank_transfer' ? bankDetails : undefined,
      mobileDetails: ['esewa', 'khalti', 'imepay'].includes(method) ? mobileDetails : undefined
    });

    await withdrawal.save();

    // Send notification to user
    await Notification.createNotification({
      recipient: userId,
      title: 'Withdrawal Request Submitted',
      message: `Your withdrawal request of NPR ${amount.toLocaleString()} has been submitted and is being processed.`,
      type: 'withdrawal',
      category: 'info',
      relatedId: withdrawal._id,
      relatedType: 'withdrawal'
    });

    // Notify admins
    const admins = await User.find({ isAdmin: true });
    const adminNotifications = admins.map(admin => ({
      recipient: admin._id,
      title: 'New Withdrawal Request',
      message: `${user.fullName} has requested a withdrawal of NPR ${amount.toLocaleString()}.`,
      type: 'withdrawal',
      category: 'info',
      relatedId: withdrawal._id,
      relatedType: 'withdrawal'
    }));

    await Notification.insertMany(adminNotifications);

    res.status(201).json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      data: withdrawal
    });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request withdrawal'
    });
  }
};

// Get withdrawal requests
const getWithdrawalRequests = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const withdrawals = await WithdrawRequest.getUserWithdrawals(userId, options);

    // Get total count
    const query = { user: userId };
    if (status) {
      query.status = status;
    }

    const total = await WithdrawRequest.countDocuments(query);

    res.json({
      success: true,
      data: withdrawals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get withdrawal requests error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get withdrawal requests'
    });
  }
};

// Get transaction history
const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, type, startDate, endDate } = req.query;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      startDate,
      endDate
    };

    const transactions = await Transaction.getWalletTransactions(wallet._id, options);

    // Get total count
    const query = { wallet: wallet._id };
    if (type) {
      query.type = type;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      data: transactions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get transaction history error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get transaction history'
    });
  }
};

// Get wallet statistics (admin only)
const getWalletStatistics = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    const stats = await Wallet.getStatistics();

    // Transaction statistics
    const transactionStats = await Transaction.getStatistics({
      startDate,
      endDate,
      type
    });

    // Withdrawal statistics
    const withdrawalStats = await WithdrawRequest.getStatistics({
      startDate,
      endDate
    });

    res.json({
      success: true,
      data: {
        walletOverview: stats[0] || {
          totalBalance: 0,
          totalEarnings: 0,
          totalSpent: 0,
          activeWallets: 0,
          frozenWallets: 0,
          avgBalance: 0
        },
        transactions: transactionStats,
        withdrawals: withdrawalStats
      }
    });
  } catch (error) {
    console.error('Get wallet statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get wallet statistics'
    });
  }
};

// Freeze wallet (admin only)
const freezeWallet = async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const adminId = req.userId;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    await wallet.freeze(reason);

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Wallet Frozen',
      message: `Your wallet has been frozen. Reason: ${reason}`,
      type: 'system',
      category: 'warning'
    });

    res.json({
      success: true,
      message: 'Wallet frozen successfully'
    });
  } catch (error) {
    console.error('Freeze wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to freeze wallet'
    });
  }
};

// Unfreeze wallet (admin only)
const unfreezeWallet = async (req, res) => {
  try {
    const { userId } = req.body;

    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        error: 'Wallet not found'
      });
    }

    await wallet.unfreeze();

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Wallet Unfrozen',
      message: 'Your wallet has been unfrozen and is now active.',
      type: 'system',
      category: 'success'
    });

    res.json({
      success: true,
      message: 'Wallet unfrozen successfully'
    });
  } catch (error) {
    console.error('Unfreeze wallet error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unfreeze wallet'
    });
  }
};

module.exports = {
  getWallet,
  addMoney,
  requestWithdrawal,
  getWithdrawalRequests,
  getTransactionHistory,
  getWalletStatistics,
  freezeWallet,
  unfreezeWallet
};