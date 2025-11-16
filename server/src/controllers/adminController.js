const User = require('../models/User');
const Service = require('../models/Service');
const Order = require('../models/Order');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const WithdrawRequest = require('../models/WithdrawRequest');
const Notification = require('../models/Notification');

// Get dashboard statistics
const getDashboardStats = async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate;
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
        break;
      case '30d':
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        break;
      case '90d':
        startDate = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
        break;
      case '1y':
        startDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000));
        break;
      default:
        startDate = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
    }

    // User statistics
    const totalUsers = await User.countDocuments({ isActive: true });
    const newUsers = await User.countDocuments({
      isActive: true,
      createdAt: { $gte: startDate }
    });
    const totalSellers = await User.countDocuments({ isSeller: true, isActive: true });

    // Service statistics
    const totalServices = await Service.countDocuments({ isActive: true });
    const newServices = await Service.countDocuments({
      isActive: true,
      createdAt: { $gte: startDate }
    });
    const featuredServices = await Service.countDocuments({
      isActive: true,
      featured: true
    });

    // Order statistics
    const totalOrders = await Order.countDocuments();
    const recentOrders = await Order.countDocuments({
      createdAt: { $gte: startDate }
    });
    const completedOrders = await Order.countDocuments({
      status: 'completed'
    });

    // Revenue statistics
    const revenueStats = await Order.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          avgOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    // Wallet statistics
    const totalWalletBalance = await Wallet.aggregate([
      {
        $group: {
          _id: null,
          totalBalance: { $sum: '$balance' }
        }
      }
    ]);

    // Withdrawal statistics
    const pendingWithdrawals = await WithdrawRequest.countDocuments({
      status: 'pending'
    });

    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          new: newUsers,
          sellers: totalSellers
        },
        services: {
          total: totalServices,
          new: newServices,
          featured: featuredServices
        },
        orders: {
          total: totalOrders,
          recent: recentOrders,
          completed: completedOrders
        },
        revenue: revenueStats[0] || {
          totalRevenue: 0,
          avgOrderValue: 0
        },
        wallet: totalWalletBalance[0] || {
          totalBalance: 0
        },
        withdrawals: {
          pending: pendingWithdrawals
        }
      }
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get dashboard statistics'
    });
  }
};

// Get users management
const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'all',
      role = 'all',
      sortBy = 'createdAt'
    } = req.query;

    const query = {};

    // Filter by status
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Filter by role
    if (role === 'seller') {
      query.isSeller = true;
    } else if (role === 'buyer') {
      query.isSeller = false;
    }

    // Text search
    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    // Sorting
    const sortOptions = {};
    switch (sortBy) {
      case 'name':
        sortOptions.fullName = 1;
        break;
      case 'email':
        sortOptions.email = 1;
        break;
      case 'sellers':
        sortOptions.isSeller = -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get users'
    });
  }
};

// Ban/unban user
const banUser = async (req, res) => {
  try {
    const { userId, reason } = req.body;
    const adminId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = false;
    await user.save();

    // Freeze user's wallet
    const wallet = await Wallet.findOne({ user: userId });
    if (wallet) {
      await wallet.freeze(`User banned: ${reason}`);
    }

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Account Suspended',
      message: `Your account has been suspended. Reason: ${reason}`,
      type: 'system',
      category: 'warning'
    });

    res.json({
      success: true,
      message: 'User banned successfully'
    });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to ban user'
    });
  }
};

// Unban user
const unbanUser = async (req, res) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    user.isActive = true;
    await user.save();

    // Unfreeze user's wallet
    const wallet = await Wallet.findOne({ user: userId });
    if (wallet && wallet.isFrozen) {
      await wallet.unfreeze();
    }

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Account Reactivated',
      message: 'Your account has been reactivated and is now active.',
      type: 'system',
      category: 'success'
    });

    res.json({
      success: true,
      message: 'User unbanned successfully'
    });
  } catch (error) {
    console.error('Unban user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to unban user'
    });
  }
};

// Get services management
const getServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      status = 'all',
      sortBy = 'createdAt'
    } = req.query;

    const query = {};

    // Filter by status
    if (status === 'active') {
      query.isActive = true;
      query.isApproved = true;
    } else if (status === 'pending') {
      query.isApproved = false;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Sorting
    const sortOptions = {};
    switch (sortBy) {
      case 'title':
        sortOptions.title = 1;
        break;
      case 'price':
        sortOptions.price = 1;
        break;
      case 'rating':
        sortOptions.rating = -1;
        break;
      case 'orders':
        sortOptions.orderCount = -1;
        break;
      default:
        sortOptions.createdAt = -1;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const services = await Service.find(query)
      .populate('provider', 'fullName avatar')
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
};

// Approve/reject service
const updateServiceStatus = async (req, res) => {
  try {
    const { serviceId, status, reason = '' } = req.body;

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    if (status === 'approved') {
      service.isApproved = true;
      service.isActive = true;
    } else if (status === 'rejected') {
      service.isApproved = false;
      service.isActive = false;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    await service.save();

    // Send notification to seller
    await Notification.createNotification({
      recipient: service.provider,
      title: `Service ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your service "${service.title}" has been ${status}${reason ? `. Reason: ${reason}` : ''}`,
      type: 'service',
      category: status === 'approved' ? 'success' : 'warning'
    });

    res.json({
      success: true,
      message: `Service ${status} successfully`
    });
  } catch (error) {
    console.error('Update service status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service status'
    });
  }
};

// Get withdrawal requests management
const getWithdrawalRequests = async (req, res) => {
  try {
    const { page = 1, limit = 20, status = 'all', sortBy = 'createdAt' } = req.query;

    const requests = await WithdrawRequest.getPendingWithdrawals();

    // Apply pagination for non-pending requests
    const skip = status === 'pending' ? 0 : (parseInt(page) - 1) * parseInt(limit);
    const limit = status === 'pending' ? requests.length : parseInt(limit);

    const paginatedRequests = requests.slice(skip, skip + limit);

    res.json({
      success: true,
      data: paginatedRequests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: requests.length,
        pages: Math.ceil(requests.length / parseInt(limit))
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

// Process withdrawal request
const processWithdrawal = async (req, res) => {
  try {
    const { withdrawalId, status, transactionId = '', notes = '' } = req.body;
    const adminId = req.userId;

    const withdrawal = await WithdrawRequest.findById(withdrawalId);
    if (!withdrawal) {
      return res.status(404).json({
        success: false,
        error: 'Withdrawal request not found'
      });
    }

    if (status === 'approved') {
      await withdrawal.approve(adminId, notes);
    } else if (status === 'rejected') {
      await withdrawal.reject(adminId, notes);
    } else if (status === 'completed') {
      await withdrawal.complete(transactionId);
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    // Send notification
    await Notification.createNotification({
      recipient: withdrawal.user,
      title: `Withdrawal ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Your withdrawal request ${withdrawal.reference} has been ${status}${notes ? `. Notes: ${notes}` : ''}`,
      type: 'withdrawal',
      category: status === 'approved' || status === 'completed' ? 'success' : 'warning'
    });

    res.json({
      success: true,
      message: `Withdrawal request ${status} successfully`
    });
  } catch (error) {
    console.error('Process withdrawal error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process withdrawal request'
    });
  }
};

module.exports = {
  getDashboardStats,
  getUsers,
  banUser,
  unbanUser,
  getServices,
  updateServiceStatus,
  getWithdrawalRequests,
  processWithdrawal
};