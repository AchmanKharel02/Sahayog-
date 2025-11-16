const Category = require('../models/Category');
const Service = require('../models/Service');
const Notification = require('../models/Notification');

// Get all categories
const getAllCategories = async (req, res) => {
  try {
    const { includeServiceCount = false, parentOnly = false } = req.query;

    let query = Category.getActiveCategories();

    if (parentOnly === 'true') {
      query = Category.getRootCategories();
    }

    const categories = await query.populate('parentCategory', 'name');

    // Include service count if requested
    if (includeServiceCount === 'true') {
      const categoriesWithCounts = await Promise.all(
        categories.map(async (category) => {
          const serviceCount = await Service.countDocuments({
            category: category._id,
            isActive: true,
            isApproved: true
          });

          const categoryObj = category.toObject();
          categoryObj.serviceCount = serviceCount;
          return categoryObj;
        })
      );

      return res.json({
        success: true,
        data: categoriesWithCounts
      });
    }

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get categories'
    });
  }
};

// Get category by ID
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const category = await Category.findById(id)
      .populate('parentCategory', 'name')
      .populate('subcategories', 'name description icon serviceCount');

    if (!category || !category.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Get popular services in this category
    const popularServices = await Service.find({
      category: id,
      isActive: true,
      isApproved: true
    })
      .populate('provider', 'fullName avatar averageRating')
      .sort({ rating: -1, orderCount: -1 })
      .limit(10)
      .select('title price images rating reviewCount provider');

    const categoryData = category.toObject();
    categoryData.popularServices = popularServices;

    res.json({
      success: true,
      data: categoryData
    });
  } catch (error) {
    console.error('Get category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category'
    });
  }
};

// Create category (admin only)
const createCategory = async (req, res) => {
  try {
    const { name, description, icon, parentCategory, color, sortOrder } = req.body;

    // Check if category already exists
    const existingCategory = await Category.findOne({ name });
    if (existingCategory) {
      return res.status(400).json({
        success: false,
        error: 'Category with this name already exists'
      });
    }

    const category = new Category({
      name,
      description,
      icon,
      parentCategory,
      color,
      sortOrder
    });

    await category.save();

    // Update parent category if provided
    if (parentCategory) {
      await Category.findByIdAndUpdate(
        parentCategory,
        { $addToSet: { subcategories: category._id } }
      );
    }

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category
    });
  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create category'
    });
  }
};

// Update category (admin only)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const category = await Category.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    res.json({
      success: true,
      message: 'Category updated successfully',
      data: category
    });
  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update category'
    });
  }
};

// Delete category (admin only)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category has services
    const serviceCount = await Service.countDocuments({ category: id });
    if (serviceCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with existing services'
      });
    }

    // Check if category has subcategories
    const subcategoryCount = await Category.countDocuments({ parentCategory: id });
    if (subcategoryCount > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete category with subcategories'
      });
    }

    const category = await Category.findByIdAndDelete(id);

    if (!category) {
      return res.status(404).json({
        success: false,
        error: 'Category not found'
      });
    }

    // Remove from parent category's subcategories
    if (category.parentCategory) {
      await Category.findByIdAndUpdate(
        category.parentCategory,
        { $pull: { subcategories: id } }
      );
    }

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete category'
    });
  }
};

// Get category statistics (admin only)
const getCategoryStats = async (req, res) => {
  try {
    const stats = await Category.aggregate([
      {
        $group: {
          _id: null,
          totalCategories: { $sum: 1 },
          activeCategories: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          avgServicesPerCategory: { $avg: '$serviceCount' },
          totalServices: { $sum: '$serviceCount' }
        }
      }
    ]);

    // Top categories by service count
    const topCategories = await Category.find({ isActive: true })
      .sort({ serviceCount: -1 })
      .limit(10)
      .select('name serviceCount');

    // Categories with no services
    const emptyCategories = await Category.find({
      isActive: true,
      serviceCount: 0
    })
      .select('name')
      .countDocuments();

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalCategories: 0,
          activeCategories: 0,
          avgServicesPerCategory: 0,
          totalServices: 0
        },
        topCategories,
        emptyCategories
      }
    });
  } catch (error) {
    console.error('Get category stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get category statistics'
    });
  }
};

// Search categories
const searchCategories = async (req, res) => {
  try {
    const { q, limit = 20 } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    const categories = await Category.find({
      isActive: true,
      $or: [
        { name: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } }
      ]
    })
      .populate('parentCategory', 'name')
      .sort({ serviceCount: -1, name: 1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('Search categories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search categories'
    });
  }
};

// Update category service count (helper function, not exposed as route)
const updateCategoryServiceCount = async (categoryId, increment = 1) => {
  try {
    await Category.findByIdAndUpdate(
      categoryId,
      { $inc: { serviceCount: increment } }
    );
  } catch (error) {
    console.error('Update category service count error:', error);
  }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats,
  searchCategories,
  updateCategoryServiceCount
};