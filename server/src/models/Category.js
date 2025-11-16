const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Category name is required'],
    trim: true,
    unique: true,
    minlength: [2, 'Category name must be at least 2 characters'],
    maxlength: [50, 'Category name cannot exceed 50 characters']
  },
  description: {
    type: String,
    maxlength: [200, 'Description cannot exceed 200 characters'],
    default: ''
  },
  icon: {
    type: String,
    default: null
  },
  isActive: {
    type: Boolean,
    default: true
  },
  serviceCount: {
    type: Number,
    default: 0,
    min: 0
  },
  parentCategory: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null
  },
  subcategories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],
  color: {
    type: String,
    default: '#4C8BF5',
    match: [/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, 'Please enter a valid color code']
  },
  sortOrder: {
    type: Number,
    default: 0,
    min: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
categorySchema.index({ name: 1 });
categorySchema.index({ isActive: 1, sortOrder: 1 });
categorySchema.index({ parentCategory: 1 });

// Virtual for popular services
categorySchema.virtual('popularServices', {
  ref: 'Service',
  localField: '_id',
  match: { isActive: true, featured: true },
  options: { limit: 5, sort: { rating: -1 } }
});

// Pre-save middleware to update parent category's subcategories
categorySchema.pre('save', async function(next) {
  if (this.isModified('parentCategory') && this.parentCategory) {
    await this.constructor.findByIdAndUpdate(
      this.parentCategory,
      { $addToSet: { subcategories: this._id } }
    );
  }
  next();
});

// Pre-remove middleware to clean up parent category
categorySchema.pre('remove', async function(next) {
  if (this.parentCategory) {
    await this.constructor.findByIdAndUpdate(
      this.parentCategory,
      { $pull: { subcategories: this._id } }
    );
  }
  next();
});

// Static method to get active categories
categorySchema.statics.getActiveCategories = function() {
  return this.find({ isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Static method to get root categories
categorySchema.statics.getRootCategories = function() {
  return this.find({ parentCategory: null, isActive: true }).sort({ sortOrder: 1, name: 1 });
};

// Instance method to add to service count
categorySchema.methods.incrementServiceCount = function() {
  this.serviceCount += 1;
  return this.save();
};

// Instance method to decrease service count
categorySchema.methods.decrementServiceCount = function() {
  if (this.serviceCount > 0) {
    this.serviceCount -= 1;
  }
  return this.save();
};

module.exports = mongoose.model('Category', categorySchema);