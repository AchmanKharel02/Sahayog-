const Service = require('../models/Service');
const Category = require('../models/Category');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { uploadServiceImages, deleteImage } = require('../services/fileService');

// Get all services (public)
const getAllServices = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      sortBy = 'rating',
      search,
      featured = false,
      provider,
      location
    } = req.query;

    const query = {
      isActive: true,
      isApproved: true
    };

    // Filters
    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    if (provider) {
      query.provider = provider;
    }

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Location filter (if provided)
    if (location) {
      const [lng, lat, radius] = location.split(',').map(val => parseFloat(val));
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: radius * 1000 // Convert km to meters
        }
      };
    }

    // Featured filter
    if (featured === 'true') {
      query.featured = true;
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'price_low':
        sortOptions = { price: 1 };
        break;
      case 'price_high':
        sortOptions = { price: -1 };
        break;
      case 'rating':
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case 'newest':
        sortOptions = { createdAt: -1 };
        break;
      case 'orders':
        sortOptions = { orderCount: -1 };
        break;
      case 'reviews':
        sortOptions = { reviewCount: -1 };
        break;
      default:
        sortOptions = search ? { score: { $meta: 'textScore' } } : { rating: -1, orderCount: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    let servicesQuery = Service.find(query)
      .populate('provider', 'fullName avatar averageRating')
      .populate('category', 'name color')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    // Add text score if searching
    if (search) {
      servicesQuery = servicesQuery.select('score');
    }

    const services = await servicesQuery;

    // Get total count for pagination
    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
};

// Get service by ID
const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const service = await Service.findById(id)
      .populate('provider', 'fullName avatar averageRating totalReviews completedOrders skills bio')
      .populate('category', 'name description color');

    if (!service || !service.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Increment view count
    service.viewCount += 1;
    await service.save();

    // Get similar services
    const similarServices = await Service.find({
      _id: { $ne: service._id },
      category: service.category,
      isActive: true,
      isApproved: true
    })
      .populate('provider', 'fullName avatar averageRating')
      .sort({ rating: -1, orderCount: -1 })
      .limit(6);

    // Get reviews
    const Review = require('../models/Review');
    const reviews = await Review.find({ service: id })
      .populate('reviewer', 'fullName avatar')
      .sort({ createdAt: -1 })
      .limit(10);

    // Check if user can order (not their own service)
    const canOrder = userId && userId !== service.provider._id.toString();

    // Check if user saved this service (if authenticated)
    let isSaved = false;
    if (userId) {
      const User = require('../models/User');
      const user = await User.findById(userId);
      isSaved = user.savedServices?.includes(service._id);
    }

    const serviceData = service.toObject();
    serviceData.similarServices = similarServices;
    serviceData.reviews = reviews;
    serviceData.canOrder = canOrder;
    serviceData.isSaved = isSaved;

    res.json({
      success: true,
      data: serviceData
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service'
    });
  }
};

// Create service (seller only)
const createService = async (req, res) => {
  try {
    const userId = req.userId;
    const {
      title,
      description,
      category,
      price,
      deliveryTime,
      revisions = 0,
      requirements = '',
      tags = []
    } = req.body;

    // Validate user is seller
    const user = await User.findById(userId);
    if (!user.isSeller) {
      return res.status(403).json({
        success: false,
        error: 'Only sellers can create services'
      });
    }

    // Check category exists
    const categoryExists = await Category.findById(category);
    if (!categoryExists || !categoryExists.isActive) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Create service
    const service = new Service({
      title,
      description,
      category,
      provider: userId,
      price,
      deliveryTime,
      revisions,
      requirements,
      tags
    });

    await service.save();

    // Handle image uploads
    if (req.files && req.files.length > 0) {
      try {
        const imageUrls = await uploadServiceImages(req.files);
        service.images = imageUrls;
        await service.save();
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue without images if upload fails
      }
    }

    // Update category service count
    await Category.findByIdAndUpdate(
      category,
      { $inc: { serviceCount: 1 } }
    );

    // Send notification to user
    await Notification.createNotification({
      recipient: userId,
      title: 'Service Created!',
      message: `Your service "${title}" has been created and is pending approval.`,
      type: 'service',
      category: 'info',
      relatedId: service._id,
      relatedType: 'service',
      actionUrl: `/my-services/${service._id}`,
      actionText: 'View Service'
    });

    // Notify admins about new service
    const admins = await User.find({ isAdmin: true });
    const adminNotifications = admins.map(admin => ({
      recipient: admin._id,
      title: 'New Service Awaiting Approval',
      message: `A new service "${title}" by ${user.fullName} is awaiting approval.`,
      type: 'system',
      category: 'info',
      relatedId: service._id,
      relatedType: 'service'
    }));

    await Notification.insertMany(adminNotifications);

    res.status(201).json({
      success: true,
      message: 'Service created successfully. It will be visible after approval.',
      data: service
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service'
    });
  }
};

// Update service (owner only)
const updateService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    const updateData = req.body;

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Check ownership
    if (service.provider.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'You can only edit your own services'
      });
    }

    // Prevent editing if service has active orders
    const Order = require('../models/Order');
    const activeOrders = await Order.countDocuments({
      service: id,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot edit service with active orders'
      });
    }

    // Handle image updates
    if (req.files && req.files.length > 0) {
      try {
        // Delete old images
        if (service.images && service.images.length > 0) {
          for (const imageUrl of service.images) {
            await deleteImage(imageUrl);
          }
        }

        const imageUrls = await uploadServiceImages(req.files);
        updateData.images = imageUrls;
      } catch (uploadError) {
        console.error('Image upload error:', uploadError);
        // Continue without updating images if upload fails
      }
    }

    // Update service
    const updatedService = await Service.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('provider', 'fullName avatar averageRating')
      .populate('category', 'name');

    res.json({
      success: true,
      message: 'Service updated successfully',
      data: updatedService
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service'
    });
  }
};

// Delete service (owner only)
const deleteService = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        error: 'Service not found'
      });
    }

    // Check ownership or admin
    if (service.provider.toString() !== userId && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'You can only delete your own services'
      });
    }

    // Prevent deletion if service has active orders
    const Order = require('../models/Order');
    const activeOrders = await Order.countDocuments({
      service: id,
      status: { $in: ['accepted', 'in_progress'] }
    });

    if (activeOrders > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete service with active orders'
      });
    }

    // Delete images
    if (service.images && service.images.length > 0) {
      for (const imageUrl of service.images) {
        await deleteImage(imageUrl);
      }
    }

    await Service.findByIdAndDelete(id);

    // Update category service count
    await Category.findByIdAndUpdate(
      service.category,
      { $inc: { serviceCount: -1 } }
    );

    // Send notification
    await Notification.createNotification({
      recipient: service.provider,
      title: 'Service Deleted',
      message: `Your service "${service.title}" has been deleted.`,
      type: 'service',
      category: 'warning'
    });

    res.json({
      success: true,
      message: 'Service deleted successfully'
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service'
    });
  }
};

// Get user's services (seller only)
const getMyServices = async (req, res) => {
  try {
    const userId = req.userId;
    const { page = 1, limit = 20, status = 'all', sortBy = 'created' } = req.query;

    const query = { provider: userId };

    // Filter by status
    if (status !== 'all') {
      switch (status) {
        case 'active':
          query.isActive = true;
          query.isApproved = true;
          break;
        case 'pending':
          query.isApproved = false;
          break;
        case 'inactive':
          query.isActive = false;
          break;
        case 'featured':
          query.featured = true;
          break;
      }
    }

    // Sorting
    let sortOptions = {};
    switch (sortBy) {
      case 'orders':
        sortOptions = { orderCount: -1 };
        break;
      case 'rating':
        sortOptions = { rating: -1 };
        break;
      case 'price_high':
        sortOptions = { price: -1 };
        break;
      case 'price_low':
        sortOptions = { price: 1 };
        break;
      default:
        sortOptions = { createdAt: -1 };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const services = await Service.find(query)
      .populate('category', 'name')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services'
    });
  }
};

// Get featured services
const getFeaturedServices = async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const services = await Service.getFeaturedServices(parseInt(limit));

    res.json({
      success: true,
      data: services
    });
  } catch (error) {
    console.error('Get featured services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get featured services'
    });
  }
};

// Search services
const searchServices = async (req, res) => {
  try {
    const {
      q,
      page = 1,
      limit = 20,
      category,
      minPrice,
      maxPrice,
      sortBy = 'relevance'
    } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const options = {
      category,
      minPrice: minPrice ? parseFloat(minPrice) : null,
      maxPrice: maxPrice ? parseFloat(maxPrice) : null,
      sortBy,
      page: parseInt(page),
      limit: parseInt(limit)
    };

    const services = await Service.searchServices(q, options);

    // Get total count for pagination
    const query = {
      $text: { $search: q },
      isActive: true,
      isApproved: true
    };

    if (category) {
      query.category = category;
    }

    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = parseFloat(minPrice);
      if (maxPrice) query.price.$lte = parseFloat(maxPrice);
    }

    const total = await Service.countDocuments(query);

    res.json({
      success: true,
      data: services,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Search services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search services'
    });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getMyServices,
  getFeaturedServices,
  searchServices
};