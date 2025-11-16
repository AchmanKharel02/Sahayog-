const express = require('express');
const router = express.Router();
const {
  register,
  login,
  refreshToken,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  logout
} = require('../controllers/authController');
const {
  authenticate,
  passwordRateLimit,
  emailRateLimit,
  passwordResetRateLimit
} = require('../middleware/auth');
const { validateRegistration, validateLogin, validatePasswordChange } = require('../middleware/validation');

// Public routes
router.post('/register', emailRateLimit, validateRegistration, register);

router.post('/login', passwordRateLimit, validateLogin, login);

router.post('/refresh', refreshToken);

router.get('/verify-email/:token', verifyEmail);

router.post('/forgot-password', passwordResetRateLimit, forgotPassword);

router.post('/reset-password/:token', validatePasswordChange, resetPassword);

// Protected routes
router.post('/change-password', authenticate, validatePasswordChange, changePassword);

router.post('/logout', authenticate, logout);

module.exports = router;