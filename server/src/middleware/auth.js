const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Authenticate user from JWT token
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token type.'
      });
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'User not found or inactive.'
      });
    }

    // Attach user to request
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token.'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired.'
      });
    }

    console.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed.'
    });
  }
};

// Check if user is seller
const isSeller = (req, res, next) => {
  if (!req.user.isSeller) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Seller privileges required.'
    });
  }
  next();
};

// Check if user is admin (placeholder for future admin system)
const isAdmin = (req, res, next) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// Optional authentication - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // No authentication required
    }

    const token = authHeader.substring(7);

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'access') {
      return next();
    }

    // Find user
    const user = await User.findById(decoded.userId);
    if (user && user.isActive) {
      req.user = user;
      req.userId = user._id;
    }

    next();
  } catch (error) {
    // Ignore authentication errors and continue
    next();
  }
};

// Check resource ownership
const checkOwnership = (resourceModel, resourceField = 'user', allowAdmin = false) => {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const userId = req.userId;

      const Resource = require(`../models/${resourceModel}`);
      const resource = await Resource.findById(resourceId);

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: `${resourceModel} not found.`
        });
      }

      // Check if user owns the resource
      const resourceUserId = resource[resourceField];
      const isOwner = resourceUserId.toString() === userId.toString();
      const isAdminUser = allowAdmin && req.user.isAdmin;

      if (!isOwner && !isAdminUser) {
        return res.status(403).json({
          success: false,
          error: 'Access denied. You do not own this resource.'
        });
      }

      req.resource = resource;
      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({
        success: false,
        error: 'Ownership check failed.'
      });
    }
  };
};

// Rate limiting for sensitive endpoints
const createRateLimit = (windowMs, max, message) => {
  return require('express-rate-limit')({
    windowMs,
    max,
    message: {
      success: false,
      error: message || 'Too many requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Custom key generator to include user ID if authenticated
    keyGenerator: (req) => {
      if (req.user) {
        return `rate_limit_${req.user._id}`;
      }
      return req.ip;
    }
  });
};

// Password attempt rate limiting
const passwordRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // 5 attempts
  'Too many password attempts. Please try again later.'
);

// Email verification rate limiting
const emailRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 verification requests
  'Too many email verification requests. Please try again later.'
);

// Password reset rate limiting
const passwordResetRateLimit = createRateLimit(
  60 * 60 * 1000, // 1 hour
  3, // 3 reset requests
  'Too many password reset requests. Please try again later.'
);

module.exports = {
  authenticate,
  isSeller,
  isAdmin,
  optionalAuth,
  checkOwnership,
  createRateLimit,
  passwordRateLimit,
  emailRateLimit,
  passwordResetRateLimit
};