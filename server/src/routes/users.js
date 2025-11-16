const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  updateAvatar,
  becomeSeller,
  getPublicProfile,
  searchUsers,
  deactivateAccount,
  getUserStats
} = require('../controllers/userController');
const { authenticate, isSeller } = require('../middleware/auth');
const { uploadSingle } = require('../services/fileService');
const { validateProfileUpdate } = require('../middleware/validation');

// Protected routes - require authentication
router.get('/profile', authenticate, getProfile);

router.put('/profile', authenticate, validateProfileUpdate, updateProfile);

router.post('/avatar', authenticate, uploadSingle('avatar'), updateAvatar);

router.post('/become-seller', authenticate, becomeSeller);

router.get('/stats', authenticate, isSeller, getUserStats);

router.post('/deactivate', authenticate, deactivateAccount);

// Public routes
router.get('/public/:userId', getPublicProfile);

router.get('/search', searchUsers);

module.exports = router;