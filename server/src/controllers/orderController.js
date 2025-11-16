const Order = require('../models/Order');
const Service = require('../models/Service');
const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');

// Create order
const createOrder = async (req, res) => {
  try {
    const { service, requirements = '' } = req.body;
    const buyerId = req.userId;

    // Get service
    const serviceData = await Service.findById(service);
    if (!serviceData || !serviceData.isActive || !serviceData.isApproved) {
      return res.status(400).json({
        success: false,
        error: 'Service not available'
      });
    }

    // Check if buyer is not the seller
    if (serviceData.provider.toString() === buyerId) {
      return res.status(400).json({
        success: false,
        error: 'You cannot order your own service'
      });
    }

    // Get buyer's wallet
    const buyerWallet = await Wallet.findOne({ user: buyerId });
    if (!buyerWallet || buyerWallet.balance < serviceData.price) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient balance'
      });
    }

    // Calculate commission
    const commissionRate = process.env.COMMISSION_RATE || 0.10;
    const commissionAmount = Math.round(serviceData.price * commissionRate);
    const sellerEarnings = serviceData.price - commissionAmount;

    // Create order
    const order = new Order({
      service,
      buyer: buyerId,
      seller: serviceData.provider,
      totalAmount: serviceData.price,
      commissionAmount,
      sellerEarnings,
      requirements,
      expectedDeliveryDate: new Date(Date.now() + (serviceData.deliveryTime * 24 * 60 * 60 * 1000))
    });

    await order.save();

    // Deduct from buyer's wallet
    await buyerWallet.deductBalance(
      serviceData.price,
      `Payment for order ${order.trackingCode}`,
      'payment',
      order._id
    );

    // Create transaction for payment
    await Transaction.create({
      wallet: buyerWallet._id,
      type: 'payment',
      amount: -serviceData.price,
      balance: buyerWallet.balance,
      description: `Payment for order ${order.trackingCode}`,
      status: 'completed',
      relatedId: order._id,
      relatedType: 'order'
    });

    // Update service order count
    serviceData.incrementOrderCount();

    // Send notifications
    await Notification.createNotification({
      recipient: buyerId,
      title: 'Order Placed Successfully!',
      message: `Your order "${order.trackingCode}" has been placed. We'll notify you when the seller accepts it.`,
      type: 'order',
      category: 'success',
      relatedId: order._id,
      relatedType: 'order',
      actionUrl: `/orders/${order._id}`,
      actionText: 'View Order'
    });

    await Notification.createNotification({
      recipient: serviceData.provider,
      title: 'New Order Received!',
      message: `You have a new order "${order.trackingCode}" for "${serviceData.title}".`,
      type: 'order',
      category: 'info',
      relatedId: order._id,
      relatedType: 'order',
      actionUrl: `/seller/orders/${order._id}`,
      actionText: 'View Order'
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${serviceData.provider}`).emit('new_order', {
        orderId: order._id,
        trackingCode: order.trackingCode,
        serviceTitle: serviceData.title,
        buyerName: (await User.findById(buyerId)).fullName
      });
    }

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      data: order
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create order'
    });
  }
};

// Get user's orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status, role = 'all' } = req.query;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      status
    };

    const orders = await Order.getUserOrders(userId, role, options);

    // Get total count for pagination
    const query = {};
    if (role !== 'all') {
      if (role === 'buyer') {
        query.buyer = userId;
      } else {
        query.seller = userId;
      }
    }

    if (status) {
      query.status = status;
    }

    const total = await Order.countDocuments(query);

    res.json({
      success: true,
      data: orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get user orders error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get orders'
    });
  }
};

// Get order by ID
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const order = await Order.findById(id)
      .populate('service', 'title images description price deliveryTime')
      .populate('buyer', 'fullName avatar')
      .populate('seller', 'fullName avatar averageRating')
      .populate('notes.author', 'fullName')
      .populate('revisionRequests.requestedBy', 'fullName');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is participant
    const isParticipant = order.buyer._id.toString() === userId ||
                      order.seller._id.toString() === userId;

    if (!isParticipant && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get order'
    });
  }
};

// Update order status
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes = '' } = req.body;
    const userId = req.userId;

    const order = await Order.findById(id)
      .populate('buyer', 'fullName')
      .populate('seller', 'fullName')
      .populate('service', 'title price');

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    const isSeller = order.seller._id.toString() === userId;
    const isAdmin = req.user.isAdmin;

    let allowedStatuses = [];

    if (isSeller) {
      allowedStatuses = ['accepted', 'in_progress', 'delivered'];
    } else if (isAdmin) {
      allowedStatuses = ['cancelled', 'disputed'];
    } else {
      // Buyer can only cancel or complete
      if (order.status === 'delivered') {
        allowedStatuses = ['completed'];
      } else if (['pending', 'accepted'].includes(order.status)) {
        allowedStatuses = ['cancelled'];
      }
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(403).json({
        success: false,
        error: 'You cannot update order to this status'
      });
    }

    // Update order status
    order.updateStatus(status, userId);

    // Add note if provided
    if (notes) {
      order.notes.push({
        author: userId,
        content: notes,
        isInternal: isAdmin
      });
    }

    await order.save();

    // Handle specific status changes
    if (status === 'completed') {
      await handleOrderCompletion(order);
    } else if (status === 'cancelled') {
      await handleOrderCancellation(order, isSeller ? 'seller' : 'buyer');
    }

    // Send notifications
    const recipientId = isSeller ? order.buyer._id : order.seller._id;
    const recipientType = isSeller ? 'buyer' : 'seller';

    await Notification.createNotification({
      recipient: recipientId,
      title: `Order ${status.charAt(0).toUpperCase() + status.slice(1)}`,
      message: `Order "${order.trackingCode}" has been ${status}.`,
      type: 'order',
      category: status === 'completed' ? 'success' : 'info',
      relatedId: order._id,
      relatedType: 'order',
      actionUrl: recipientType === 'buyer' ? `/orders/${order._id}` : `/seller/orders/${order._id}`,
      actionText: 'View Order'
    });

    // Emit socket event
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${recipientId}`).emit('order_status_update', {
        orderId: order._id,
        trackingCode: order.trackingCode,
        status,
        updatedBy: isSeller ? 'seller' : 'buyer'
      });
    }

    res.json({
      success: true,
      message: `Order ${status} successfully`,
      data: order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update order status'
    });
  }
};

// Handle order completion
const handleOrderCompletion = async (order) => {
  try {
    // Add to seller's wallet
    const sellerWallet = await Wallet.findOne({ user: order.seller });
    await sellerWallet.addBalance(
      order.sellerEarnings,
      `Earnings from order ${order.trackingCode}`,
      'earning',
      order._id
    );

    // Create transaction for seller
    await Transaction.create({
      wallet: sellerWallet._id,
      type: 'earning',
      amount: order.sellerEarnings,
      balance: sellerWallet.balance,
      description: `Earnings from order ${order.trackingCode}`,
      status: 'completed',
      relatedId: order._id,
      relatedType: 'order'
    });

    // Update seller stats
    await User.findByIdAndUpdate(
      order.seller,
      { $inc: { completedOrders: 1 } }
    );

    // Update buyer stats
    await User.findByIdAndUpdate(
      order.buyer,
      { $inc: { completedOrders: 1 } }
    );

    // Send completion notifications
    await Notification.createNotification({
      recipient: order.seller,
      title: 'Order Completed - Payment Received!',
      message: `Order "${order.trackingCode}" has been completed. NPR ${order.sellerEarnings.toLocaleString()} has been added to your wallet.`,
      type: 'payment',
      category: 'success',
      relatedId: order._id,
      relatedType: 'order'
    });
  } catch (error) {
    console.error('Handle order completion error:', error);
  }
};

// Handle order cancellation
const handleOrderCancellation = async (order, cancelledBy) => {
  try {
    // Refund buyer
    const buyerWallet = await Wallet.findOne({ user: order.buyer });
    await buyerWallet.addBalance(
      order.totalAmount,
      `Refund for cancelled order ${order.trackingCode}`,
      'refund',
      order._id
    );

    // Create refund transaction
    await Transaction.create({
      wallet: buyerWallet._id,
      type: 'refund',
      amount: order.totalAmount,
      balance: buyerWallet.balance,
      description: `Refund for cancelled order ${order.trackingCode}`,
      status: 'completed',
      relatedId: order._id,
      relatedType: 'order'
    });

    // Send refund notification
    await Notification.createNotification({
      recipient: order.buyer,
      title: 'Order Cancelled - Refund Processed',
      message: `Order "${order.trackingCode}" has been cancelled. NPR ${order.totalAmount.toLocaleString()} has been refunded to your wallet.`,
      type: 'payment',
      category: 'warning',
      relatedId: order._id,
      relatedType: 'order'
    });
  } catch (error) {
    console.error('Handle order cancellation error:', error);
  }
};

// Add order note
const addOrderNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;
    const userId = req.userId;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is participant
    const isParticipant = order.buyer.toString() === userId ||
                      order.seller.toString() === userId;

    if (!isParticipant && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    order.notes.push({
      author: userId,
      content,
      isInternal: isInternal || req.user.isAdmin
    });

    await order.save();

    res.status(201).json({
      success: true,
      message: 'Note added successfully',
      data: order
    });
  } catch (error) {
    console.error('Add order note error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add note'
    });
  }
};

// Request revision
const requestRevision = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userId = req.userId;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check if user is buyer and order is delivered
    if (order.buyer.toString() !== userId || order.status !== 'delivered') {
      return res.status(400).json({
        success: false,
        error: 'Cannot request revision for this order'
      });
    }

    // Check if service allows revisions
    const service = await Service.findById(order.service);
    if (service.revisions <= 0) {
      return res.status(400).json({
        success: false,
        error: 'This service does not allow revisions'
      });
    }

    // Check revision limit
    const existingRevisions = order.revisionRequests.filter(
      r => r.status !== 'rejected'
    ).length;

    if (existingRevisions >= service.revisions) {
      return res.status(400).json({
        success: false,
        error: 'Maximum revision limit reached'
      });
    }

    order.revisionRequests.push({
      requestedBy: userId,
      reason,
      status: 'pending'
    });

    order.status = 'in_progress';
    await order.save();

    // Send notification to seller
    await Notification.createNotification({
      recipient: order.seller,
      title: 'Revision Requested',
      message: `Buyer has requested a revision for order "${order.trackingCode}".`,
      type: 'order',
      category: 'info',
      relatedId: order._id,
      relatedType: 'order'
    });

    res.status(201).json({
      success: true,
      message: 'Revision requested successfully',
      data: order
    });
  } catch (error) {
    console.error('Request revision error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to request revision'
    });
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  updateOrderStatus,
  addOrderNote,
  requestRevision
};