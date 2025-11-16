const express = require('express');
const router = express.Router();
const {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  searchCategories
} = require('../controllers/categoryController');
const { authenticate, isAdmin } = require('../middleware/auth');

// Public routes
router.get('/', getAllCategories);

router.get('/search', searchCategories);

router.get('/:id', getCategoryById);

// Admin only routes
router.post('/', authenticate, isAdmin, createCategory);

router.put('/:id', authenticate, isAdmin, updateCategory);

router.delete('/:id', authenticate, isAdmin, deleteCategory);

router.get('/stats/admin', authenticate, isAdmin, getCategoryStats);

module.exports = router;