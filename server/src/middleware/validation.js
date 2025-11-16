const Joi = require('joi');

// User registration validation
const validateRegistration = (req, res, next) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .min(2)
      .max(100)
      .required()
      .messages({
        'string.empty': 'Full name is required',
        'string.min': 'Full name must be at least 2 characters',
        'string.max': 'Full name cannot exceed 100 characters',
        'any.required': 'Full name is required'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters',
        'string.max': 'Password cannot exceed 128 characters',
        'any.required': 'Password is required'
      }),
    phone: Joi.string()
      .pattern(/^(97|98)\d{8}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Please enter a valid Nepali phone number (starts with 97 or 98)'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// User login validation
const validateLogin = (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.empty': 'Email is required',
        'string.email': 'Please enter a valid email address',
        'any.required': 'Email is required'
      }),
    password: Joi.string()
      .required()
      .messages({
        'string.empty': 'Password is required',
        'any.required': 'Password is required'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Password change validation
const validatePasswordChange = (req, res, next) => {
  const schema = Joi.object({
    currentPassword: Joi.string()
      .required()
      .messages({
        'string.empty': 'Current password is required',
        'any.required': 'Current password is required'
      }),
    newPassword: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.empty': 'New password is required',
        'string.min': 'New password must be at least 6 characters',
        'string.max': 'New password cannot exceed 128 characters',
        'any.required': 'New password is required'
      }),
    password: Joi.string()
      .min(6)
      .max(128)
      .required()
      .messages({
        'string.empty': 'Password is required',
        'string.min': 'Password must be at least 6 characters',
        'string.max': 'Password cannot exceed 128 characters',
        'any.required': 'Password is required'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Profile update validation
const validateProfileUpdate = (req, res, next) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .min(2)
      .max(100)
      .optional()
      .messages({
        'string.min': 'Full name must be at least 2 characters',
        'string.max': 'Full name cannot exceed 100 characters'
      }),
    phone: Joi.string()
      .pattern(/^(97|98)\d{8}$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Please enter a valid Nepali phone number (starts with 97 or 98)'
      }),
    bio: Joi.string()
      .max(500)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Bio cannot exceed 500 characters'
      }),
    skills: Joi.array()
      .items(Joi.string().max(50))
      .max(20)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 20 skills',
        'string.max': 'Each skill cannot exceed 50 characters'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Service creation validation
const validateServiceCreation = (req, res, next) => {
  const schema = Joi.object({
    title: Joi.string()
      .min(10)
      .max(200)
      .required()
      .messages({
        'string.empty': 'Service title is required',
        'string.min': 'Title must be at least 10 characters',
        'string.max': 'Title cannot exceed 200 characters',
        'any.required': 'Service title is required'
      }),
    description: Joi.string()
      .min(50)
      .max(5000)
      .required()
      .messages({
        'string.empty': 'Service description is required',
        'string.min': 'Description must be at least 50 characters',
        'string.max': 'Description cannot exceed 5000 characters',
        'any.required': 'Service description is required'
      }),
    category: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.empty': 'Category is required',
        'string.pattern.base': 'Invalid category ID',
        'any.required': 'Category is required'
      }),
    price: Joi.number()
      .min(100)
      .max(100000)
      .required()
      .messages({
        'number.base': 'Price must be a number',
        'number.min': 'Price must be at least NPR 100',
        'number.max': 'Price cannot exceed NPR 100,000',
        'any.required': 'Price is required'
      }),
    deliveryTime: Joi.number()
      .min(1)
      .max(30)
      .required()
      .messages({
        'number.base': 'Delivery time must be a number',
        'number.min': 'Delivery time must be at least 1 day',
        'number.max': 'Delivery time cannot exceed 30 days',
        'any.required': 'Delivery time is required'
      }),
    revisions: Joi.number()
      .min(0)
      .max(10)
      .default(0)
      .messages({
        'number.min': 'Revisions cannot be negative',
        'number.max': 'Revisions cannot exceed 10'
      }),
    requirements: Joi.string()
      .max(1000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Requirements cannot exceed 1000 characters'
      }),
    images: Joi.array()
      .items(Joi.string().uri())
      .max(5)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 5 images',
        'string.uri': 'Each image must be a valid URL'
      }),
    tags: Joi.array()
      .items(Joi.string().max(30))
      .max(10)
      .optional()
      .messages({
        'array.max': 'Cannot have more than 10 tags',
        'string.max': 'Each tag cannot exceed 30 characters'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Order creation validation
const validateOrderCreation = (req, res, next) => {
  const schema = Joi.object({
    service: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.empty': 'Service is required',
        'string.pattern.base': 'Invalid service ID',
        'any.required': 'Service is required'
      }),
    requirements: Joi.string()
      .max(2000)
      .allow('')
      .optional()
      .messages({
        'string.max': 'Requirements cannot exceed 2000 characters'
      })
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Review creation validation
const validateReviewCreation = (req, res, next) => {
  const schema = Joi.object({
    order: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.empty': 'Order ID is required',
        'string.pattern.base': 'Invalid order ID',
        'any.required': 'Order ID is required'
      }),
    rating: Joi.number()
      .min(1)
      .max(5)
      .required()
      .messages({
        'number.base': 'Rating must be a number',
        'number.min': 'Rating must be at least 1',
        'number.max': 'Rating cannot exceed 5',
        'any.required': 'Rating is required'
      }),
    comment: Joi.string()
      .min(10)
      .max(1000)
      .required()
      .messages({
        'string.empty': 'Review comment is required',
        'string.min': 'Comment must be at least 10 characters',
        'string.max': 'Comment cannot exceed 1000 characters',
        'any.required': 'Review comment is required'
      }),
    aspects: Joi.object({
      communication: Joi.number().min(1).max(5).optional(),
      quality: Joi.number().min(1).max(5).optional(),
      delivery: Joi.number().min(1).max(5).optional(),
      value: Joi.number().min(1).max(5).optional()
    }).optional(),
    isRecommended: Joi.boolean().optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Message validation
const validateMessage = (req, res, next) => {
  const schema = Joi.object({
    receiver: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        'string.empty': 'Receiver is required',
        'string.pattern.base': 'Invalid receiver ID',
        'any.required': 'Receiver is required'
      }),
    content: Joi.string()
      .min(1)
      .max(2000)
      .when('fileUrl', {
        is: null,
        then: Joi.required(),
        otherwise: Joi.optional()
      })
      .messages({
        'string.empty': 'Message content is required when no file is attached',
        'string.min': 'Message cannot be empty',
        'string.max': 'Message cannot exceed 2000 characters'
      }),
    fileUrl: Joi.string()
      .uri()
      .allow(null)
      .optional()
      .messages({
        'string.uri': 'File URL must be a valid URL'
      }),
    fileName: Joi.string()
      .max(255)
      .allow(null)
      .optional(),
    fileType: Joi.string()
      .valid('image', 'document', 'audio', 'video')
      .allow(null)
      .optional(),
    fileSize: Joi.number()
      .min(0)
      .allow(null)
      .optional(),
    orderId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .allow(null)
      .optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

// Withdrawal request validation
const validateWithdrawalRequest = (req, res, next) => {
  const schema = Joi.object({
    amount: Joi.number()
      .min(process.env.MIN_WITHDRAWAL || 500)
      .max(1000000)
      .required()
      .messages({
        'number.base': 'Amount must be a number',
        'number.min': `Minimum withdrawal amount is NPR ${process.env.MIN_WITHDRAWAL || 500}`,
        'number.max': 'Maximum withdrawal amount is NPR 1,000,000',
        'any.required': 'Amount is required'
      }),
    method: Joi.string()
      .valid('bank_transfer', 'esewa', 'khalti', 'imepay')
      .required()
      .messages({
        'string.empty': 'Withdrawal method is required',
        'any.only': 'Invalid withdrawal method',
        'any.required': 'Withdrawal method is required'
      }),
    bankDetails: Joi.object({
      bankName: Joi.string().max(100).when('method', {
        is: 'bank_transfer',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      accountNumber: Joi.string().max(50).when('method', {
        is: 'bank_transfer',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      accountName: Joi.string().max(100).when('method', {
        is: 'bank_transfer',
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      branch: Joi.string().max(100).optional()
    }).optional(),
    mobileDetails: Joi.object({
      number: Joi.string().pattern(/^(97|98)\d{8}$/).when('method', {
        is: Joi.valid('esewa', 'khalti', 'imepay'),
        then: Joi.required(),
        otherwise: Joi.optional()
      }),
      provider: Joi.string().valid('ntc', 'ncell').when('method', {
        is: Joi.valid('esewa', 'khalti', 'imepay'),
        then: Joi.required(),
        otherwise: Joi.optional()
      })
    }).optional(),
    reason: Joi.string()
      .max(500)
      .allow('')
      .optional()
  });

  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin,
  validatePasswordChange,
  validateProfileUpdate,
  validateServiceCreation,
  validateOrderCreation,
  validateReviewCreation,
  validateMessage,
  validateWithdrawalRequest
};