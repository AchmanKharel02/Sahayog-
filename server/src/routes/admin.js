const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  banUser,
  unbanUser,
  getServices,
  updateServiceStatus,
  getWithdrawalRequests,
  processWithdrawal
} = require('../controllers/adminController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Admin only routes
router.get('/dashboard', authenticate, isAdmin, getDashboardStats);

router.get('/users', authenticate, isAdmin, getUsers);

router.post('/users/ban', authenticate, isAdmin, banUser);

router.post('/users/unban', authenticate, isAdmin, unbanUser);

router.get('/services', authenticate, isAdmin, getServices);

router.put('/services/status', authenticate, isAdmin, updateServiceStatus);

router.get('/withdrawals', authenticate, isAdmin, getWithdrawalRequests);

router.put('/withdrawals/process', authenticate, isAdmin, processWithdrawal);

module.exports = router;