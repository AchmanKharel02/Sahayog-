const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Notification = require('../models/Notification');
const { uploadImage } = require('../services/fileService');

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    const wallet = await Wallet.findOne({ user: user._id });

    res.json({
      success: true,
      data: {
        user: user.getPublicProfile(),
        wallet: {
          balance: wallet?.balance || 0,
          currency: wallet?.currency || 'NPR',
          isFrozen: wallet?.isFrozen || false
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, phone, bio, skills } = req.body;
    const userId = req.userId;

    const updateData = {};
    if (fullName) updateData.fullName = fullName;
    if (phone !== undefined) updateData.phone = phone;
    if (bio !== undefined) updateData.bio = bio;
    if (skills !== undefined) updateData.skills = skills;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Profile Updated',
      message: 'Your profile has been updated successfully.',
      type: 'profile',
      category: 'success'
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

// Update user avatar
const updateAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const userId = req.userId;
    const imageUrl = await uploadImage(req.file, 'avatars');

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar: imageUrl },
      { new: true }
    );

    // Send notification
    await Notification.createNotification({
      recipient: userId,
      title: 'Avatar Updated',
      message: 'Your profile picture has been updated successfully.',
      type: 'profile',
      category: 'success'
    });

    res.json({
      success: true,
      message: 'Avatar updated successfully',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update avatar'
    });
  }
};

// Become a seller
const becomeSeller = async (req, res) => {
  try {
    const user = req.user;

    if (user.isSeller) {
      return res.status(400).json({
        success: false,
        error: 'You are already a seller'
      });
    }

    user.isSeller = true;
    await user.save();

    // Send notification
    await Notification.createNotification({
      recipient: user._id,
      title: 'Seller Account Created!',
      message: 'Congratulations! You can now create and sell services on SAHAYOG.',
      type: 'profile',
      category: 'success',
      actionUrl: '/create-service',
      actionText: 'Create Service'
    });

    res.json({
      success: true,
      message: 'You are now a seller! You can create services.',
      data: user.getPublicProfile()
    });
  } catch (error) {
    console.error('Become seller error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to become seller'
    });
  }
};

// Get user's public profile
const getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.userId;

    const user = await User.findById(userId)
      .populate('wallet', 'balance totalEarnings completedOrders')
      .select('-password -emailVerificationToken -passwordResetToken -passwordResetExpires');

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Get user's services if seller
    let services = [];
    if (user.isSeller) {
      const Service = require('../models/Service');
      services = await Service.find({
        provider: userId,
        isActive: true,
        isApproved: true
      })
        .select('title price rating reviewCount images category')
        .populate('category', 'name')
        .limit(10);
    }

    // Get user's reviews
    const Review = require('../models/Review');
    const reviews = await Review.find({ reviewee: userId })
      .populate('reviewer', 'fullName avatar')
      .select('rating comment createdAt aspects')
      .sort({ createdAt: -1 })
      .limit(5);

    const profileData = user.getPublicProfile();
    profileData.wallet = user.wallet;
    profileData.services = services;
    profileData.reviews = reviews;

    res.json({
      success: true,
      data: profileData
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

// Search users (for finding sellers)
const searchUsers = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      sortBy = 'rating',
      category,
      skills
    } = req.query;

    const query = {
      isSeller: true,
      isActive: true
    };

    // Text search
    if (q) {
      query.$text = { $search: q };
    }

    // Filter by skills
    if (skills) {
      const skillArray = Array.isArray(skills) ? skills : skills.split(',');
      query.skills = { $in: skillArray };
    }

    const skip = (page - 1) * limit;

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'rating':
        sortOptions = { averageRating: -1, totalReviews: -1 };
        break;
      case 'orders':
        sortOptions = { completedOrders: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      default:
        sortOptions = q ? { score: { $meta: 'textScore' } } : { averageRating: -1 };
    }

    let usersQuery = User.find(query)
      .select('fullName avatar averageRating totalReviews completedOrders skills bio')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Add text score if searching
    if (q) {
      usersQuery = usersQuery.select('score');
    }

    const users = await usersQuery;

    // Get services count for each user if category filter is applied
    if (category) {
      const Service = require('../models/Service');
      const userIds = users.map(user => user._id);

      const serviceCounts = await Service.aggregate([
        {
          $match: {
            provider: { $in: userIds },
            category: require('mongoose').Types.ObjectId(category),
            isActive: true,
            isApproved: true
          }
        },
        {
          $group: {
            _id: '$provider',
            count: { $sum: 1 }
          }
        }
      ]);

      const countMap = serviceCounts.reduce((acc, item) => {
        acc[item._id.toString()] = item.count;
        return acc;
      }, {});

      users.forEach(user => {
        user.servicesInCategory = countMap[user._id.toString()] || 0;
      });
    }

    res.json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: users.length
      }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search users'
    });
  }
};

// Deactivate account
const deactivateAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userId;

    // Verify password
    const user = await User.findById(userId).select('+password');
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Deactivate user
    user.isActive = false;
    await user.save();

    // Freeze wallet
    const Wallet = require('../models/Wallet');
    await Wallet.findOneAndUpdate(
      { user: userId },
      {
        isFrozen: true,
        frozenReason: 'Account deactivated by user'
      }
    );

    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('Deactivate account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deactivate account'
    });
  }
};

// Get user statistics (for sellers)
const getUserStats = async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    if (!user.isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only sellers can view statistics'
      });
    }

    const Service = require('../models/Service');
    const Order = require('../models/Order');
    const Review = require('../models/Review');
    const Wallet = require('../models/Wallet');

    // Get service stats
    const serviceStats = await Service.aggregate([
      { $match: { provider: user._id } },
      {
        $group: {
          _id: null,
          totalServices: { $sum: 1 },
          activeServices: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          avgPrice: { $avg: '$price' },
          totalOrders: { $sum: '$orderCount' }
        }
      }
    ]);

    // Get order stats
    const orderStats = await Order.aggregate([
      { $match: { seller: user._id } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalRevenue: { $sum: '$sellerEarnings' }
        }
      }
    ]);

    // Get review stats
    const reviewStats = await Review.aggregate([
      { $match: { reviewee: user._id } },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          ratingCounts: {
            $push: '$rating'
          }
        }
      }
    ]);

    // Get wallet
    const wallet = await Wallet.findOne({ user: userId });

    const stats = {
      services: serviceStats[0] || {
        totalServices: 0,
        activeServices: 0,
        avgPrice: 0,
        totalOrders: 0
      },
      orders: orderStats.reduce((acc, curr) => {
        acc[curr._id] = {
          count: curr.count,
          revenue: curr.totalRevenue
        };
        return acc;
      }, {}),
      reviews: reviewStats[0] || {
        totalReviews: 0,
        avgRating: 0
      },
      wallet: {
        balance: wallet?.balance || 0,
        totalEarnings: wallet?.totalEarnings || 0,
        totalWithdrawals: wallet?.totalWithdrawals || 0
      }
    };

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get user stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get statistics'
    });
  }
};

module.exports = {
  getProfile,
  updateProfile,
  updateAvatar,
  becomeSeller,
  getPublicProfile,
  searchUsers,
  deactivateAccount,
  getUserStats
};