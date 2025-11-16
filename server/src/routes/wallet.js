const express = require('express');
const router = express.Router();
const {
  getWallet,
  addMoney,
  requestWithdrawal,
  getWithdrawalRequests,
  getTransactionHistory,
  getWalletStatistics,
  freezeWallet,
  unfreezeWallet
} = require('../controllers/walletController');
const { authenticate, isAdmin } = require('../middleware/auth');
const { validateWithdrawalRequest } = require('../middleware/validation');

// Protected user routes
router.get('/', authenticate, getWallet);

router.post('/withdraw', authenticate, validateWithdrawalRequest, requestWithdrawal);

router.get('/withdrawals', authenticate, getWithdrawalRequests);

router.get('/transactions', authenticate, getTransactionHistory);

// Admin only routes
router.post('/add-money', authenticate, isAdmin, addMoney);

router.get('/statistics', authenticate, isAdmin, getWalletStatistics);

router.post('/freeze', authenticate, isAdmin, freezeWallet);

router.post('/unfreeze', authenticate, isAdmin, unfreezeWallet);

module.exports = router;