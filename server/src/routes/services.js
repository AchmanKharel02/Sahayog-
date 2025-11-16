const express = require('express');
const router = express.Router();
const {
  getAllServices,
  getServiceById,
  createService,
  updateService,
  deleteService,
  getMyServices,
  getFeaturedServices,
  searchServices
} = require('../controllers/serviceController');
const { authenticate, isSeller, checkOwnership } = require('../middleware/auth');
const { uploadMultiple } = require('../services/fileService');
const { validateServiceCreation } = require('../middleware/validation');

// Public routes
router.get('/', getAllServices);

router.get('/featured', getFeaturedServices);

router.get('/search', searchServices);

router.get('/:id', getServiceById);

// Protected seller routes
router.post('/', authenticate, isSeller, uploadMultiple('images'), validateServiceCreation, createService);

router.get('/my/list', authenticate, isSeller, getMyServices);

router.put('/:id', authenticate, isSeller, checkOwnership('Service'), updateService);

router.delete('/:id', authenticate, checkOwnership('Service'), deleteService);

module.exports = router;