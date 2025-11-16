const Review = require('../models/Review');
const Order = require('../models/Order');
const Service = require('../models/Service');
const Notification = require('../models/Notification');

// Create review
const createReview = async (req, res) => {
  try {
    const { order, rating, comment, aspects, isRecommended } = req.body;
    const userId = req.userId;

    // Check if order exists and is completed
    const orderData = await Order.findById(order).populate('service');
    if (!orderData) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    if (orderData.status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Can only review completed orders'
      });
    }

    // Check if user is the buyer
    if (orderData.buyer.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only buyers can write reviews'
      });
    }

    // Check if review already exists
    const existingReview = await Review.findOne({ order });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        error: 'Review already exists for this order'
      });
    }

    // Create review
    const review = new Review({
      order,
      service: orderData.service._id,
      reviewer: userId,
      reviewee: orderData.seller,
      rating,
      comment,
      aspects,
      isRecommended
    });

    await review.save();

    // Update service rating
    await orderData.service.updateRating();

    // Send notification to seller
    await Notification.createNotification({
      recipient: orderData.seller,
      title: 'New Review Received!',
      message: `You received a ${rating}-star review for "${orderData.service.title}"`,
      type: 'review',
      category: 'info',
      relatedId: review._id,
      relatedType: 'review',
      actionUrl: `/reviews/${review._id}`,
      actionText: 'View Review'
    });

    res.status(201).json({
      success: true,
      message: 'Review created successfully',
      data: review
    });
  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create review'
    });
  }
};

// Get service reviews
const getServiceReviews = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const { page = 1, limit = 20, rating } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      rating
    };

    const reviews = await Review.getServiceReviews(serviceId, options);

    // Get total count for pagination
    const query = { service: serviceId, isHidden: false };
    if (rating) {
      query.rating = parseInt(rating);
    }

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get service reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
};

// Get user reviews
const getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20, role = 'reviewee', rating } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      rating
    };

    const reviews = await Review.getUserReviews(userId, role, options);

    // Get total count
    const query = { [role]: userId, isHidden: false };
    if (rating) {
      query.rating = parseInt(rating);
    }

    const total = await Review.countDocuments(query);

    res.json({
      success: true,
      data: reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get user reviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get reviews'
    });
  }
};

// Update review (only by reviewer within 24 hours)
const updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Check if user is reviewer and within 24 hours
    const isReviewer = review.reviewer.toString() === userId;
    const timeDiff = Date.now() - review.createdAt.getTime();
    const canEdit = isReviewer && timeDiff < (24 * 60 * 60 * 1000);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit this review'
      });
    }

    await review.editReview(rating, comment);

    res.json({
      success: true,
      message: 'Review updated successfully',
      data: review
    });
  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review'
    });
  }
};

// Add response to review (by service owner)
const addResponse = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { responseContent } = req.body;
    const userId = req.userId;

    const review = await Review.findById(reviewId).populate('service');
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Check if user is service owner
    if (review.service.provider.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Only service owner can respond to reviews'
      });
    }

    if (review.response && review.response.content) {
      return res.status(400).json({
        success: false,
        error: 'Review already has a response'
      });
    }

    await review.addResponse(responseContent);

    // Send notification to reviewer
    await Notification.createNotification({
      recipient: review.reviewer,
      title: 'Response to Your Review',
      message: `The service owner responded to your review for "${review.service.title}"`,
      type: 'review',
      category: 'info',
      relatedId: review._id,
      relatedType: 'review'
    });

    res.json({
      success: true,
      message: 'Response added successfully',
      data: review
    });
  } catch (error) {
    console.error('Add response error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add response'
    });
  }
};

// Mark review as helpful
const markHelpful = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const userId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    await review.markHelpful(userId);

    res.json({
      success: true,
      message: 'Review marked as helpful',
      data: {
        helpfulVotes: review.helpfulVotes,
        totalVotes: review.totalVotes
      }
    });
  } catch (error) {
    console.error('Mark helpful error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark review as helpful'
    });
  }
};

// Report review
const reportReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        error: 'Review not found'
      });
    }

    // Increment report count
    review.reportCount += 1;
    await review.save();

    // If report count is high, hide the review
    if (review.reportCount >= 5) {
      review.isHidden = true;
      await review.save();
    }

    // Send notification to admins
    const User = require('../models/User');
    const admins = await User.find({ isAdmin: true });
    const adminNotifications = admins.map(admin => ({
      recipient: admin._id,
      title: 'Review Reported',
      message: `A review has been reported. Reason: ${reason}`,
      type: 'system',
      category: 'warning'
    }));

    await Notification.insertMany(adminNotifications);

    res.json({
      success: true,
      message: 'Review reported successfully'
    });
  } catch (error) {
    console.error('Report review error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to report review'
    });
  }
};

// Get review statistics (admin only)
const getReviewStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const stats = await Review.aggregate([
      {
        $match: {
          ...(startDate || endDate ? {
            createdAt: {
              ...(startDate && { $gte: new Date(startDate) }),
              ...(endDate && { $lte: new Date(endDate) })
            }
          } : {})
        }
      },
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: '$rating' },
          ratingDistribution: {
            $push: '$rating'
          },
          recommendedCount: {
            $sum: { $cond: [{ $eq: ['$isRecommended', true] }, 1, 0] }
          },
          hiddenReviews: {
            $sum: { $cond: [{ $eq: ['$isHidden', true] }, 1, 0] }
          }
        }
      }
    ]);

    // Calculate rating distribution
    const ratingDist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    if (stats[0] && stats[0].ratingDistribution) {
      stats[0].ratingDistribution.forEach(rating => {
        ratingDist[rating] = (ratingDist[rating] || 0) + 1;
      });
    }

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalReviews: 0,
          avgRating: 0,
          recommendedCount: 0,
          hiddenReviews: 0
        },
        ratingDistribution: ratingDist
      }
    });
  } catch (error) {
    console.error('Get review stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get review statistics'
    });
  }
};

module.exports = {
  createReview,
  getServiceReviews,
  getUserReviews,
  updateReview,
  addResponse,
  markHelpful,
  reportReview,
  getReviewStats
};