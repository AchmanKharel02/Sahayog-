const express = require('express');
const router = express.Router();
const {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  addOrderNote,
  requestRevision
} = require('../controllers/orderController');
const { authenticate } = require('../middleware/auth');
const { validateOrderCreation } = require('../middleware/validation');

// Protected routes
router.post('/', authenticate, validateOrderCreation, createOrder);

router.get('/', authenticate, getUserOrders);

router.get('/:id', authenticate, getOrderById);

router.put('/:id/status', authenticate, updateOrderStatus);

router.post('/:id/notes', authenticate, addOrderNote);

router.post('/:id/revision', authenticate, requestRevision);

module.exports = router;