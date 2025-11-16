const express = require('express');
const router = express.Router();
const {
  createReview,
  getServiceReviews,
  getUserReviews,
  updateReview,
  addResponse,
  markHelpful,
  reportReview,
  getReviewStats
} = require('../controllers/reviewController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validateReviewCreation } = require('../middleware/validation');

// Public routes
router.get('/service/:serviceId', getServiceReviews);

router.get('/user/:userId', getUserReviews);

// Protected routes
router.post('/', authenticate, validateReviewCreation, createReview);

router.put('/:reviewId', authenticate, updateReview);

router.post('/:reviewId/response', authenticate, addResponse);

router.post('/:reviewId/helpful', authenticate, markHelpful);

router.post('/:reviewId/report', authenticate, reportReview);

// Admin only routes
router.get('/statistics', authenticate, isAdmin, getReviewStats);

module.exports = router;