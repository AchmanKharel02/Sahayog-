const multer = require('multer');
const path = require('path');
const fs = require('fs/promises');

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter
const fileFilter = (req, file, cb) => {
  // Allowed file types
  const allowedTypes = {
    'image/jpeg': true,
    'image/jpg': true,
    'image/png': true,
    'image/gif': true,
    'image/webp': true,
    'application/pdf': true,
    'application/msword': true,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
    'audio/mpeg': true,
    'audio/wav': true,
    'audio/mp3': true,
    'video/mp4': true,
    'video/mpeg': true
  };

  if (allowedTypes[file.mimetype]) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

// Create upload middleware
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5 // Maximum 5 files
  },
  fileFilter
});

// Single file upload middleware
const uploadSingle = (fieldName) => upload.single(fieldName);

// Multiple files upload middleware
const uploadMultiple = (fieldName, maxCount = 5) => upload.array(fieldName, maxCount);

// Save file to disk (fallback if Cloudinary not configured)
const saveFileToDisk = async (file, folder = 'uploads') => {
  try {
    const uploadsDir = path.join(__dirname, '../../uploads', folder);
    await fs.mkdir(uploadsDir, { recursive: true });

    const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.writeFile(filePath, file.buffer);

    return `/uploads/${folder}/${fileName}`;
  } catch (error) {
    console.error('File save error:', error);
    throw new Error('Failed to save file');
  }
};

// Upload to Cloudinary (if configured)
const uploadToCloudinary = async (file, folder = 'sahayog') => {
  try {
    const cloudinary = require('cloudinary').v2;

    // Configure Cloudinary if not already configured
    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }

    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          folder: folder,
          quality: 'auto',
          fetch_format: 'auto'
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result.secure_url);
          }
        }
      ).end(file.buffer);
    });
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    // Fallback to disk storage
    return saveFileToDisk(file);
  }
};

// Main upload function
const uploadImage = async (file, folder = 'images') => {
  try {
    // Check if Cloudinary is configured
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
      return await uploadToCloudinary(file, folder);
    } else {
      return await saveFileToDisk(file, folder);
    }
  } catch (error) {
    console.error('Image upload error:', error);
    throw new Error('Failed to upload image');
  }
};

// Upload multiple files
const uploadImages = async (files, folder = 'images') => {
  try {
    const uploadPromises = files.map(file => uploadImage(file, folder));
    return await Promise.all(uploadPromises);
  } catch (error) {
    console.error('Multiple images upload error:', error);
    throw new Error('Failed to upload images');
  }
};

// Delete file (if saved to disk)
const deleteFile = async (filePath) => {
  try {
    if (filePath && filePath.startsWith('/uploads/')) {
      const fullPath = path.join(__dirname, '../../..', filePath);
      await fs.unlink(fullPath);
    }
  } catch (error) {
    console.error('File deletion error:', error);
    // Don't throw error for file deletion
  }
};

// Delete Cloudinary image
const deleteCloudinaryImage = async (imageUrl) => {
  try {
    const cloudinary = require('cloudinary').v2;

    if (!cloudinary.config().cloud_name) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }

    // Extract public ID from URL
    const publicId = imageUrl.split('/').pop().split('.')[0];

    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    });
  } catch (error) {
    console.error('Cloudinary deletion error:', error);
    throw new Error('Failed to delete image');
  }
};

// Main delete function
const deleteImage = async (imageUrl) => {
  try {
    if (imageUrl.includes('cloudinary.com')) {
      await deleteCloudinaryImage(imageUrl);
    } else {
      await deleteFile(imageUrl);
    }
  } catch (error) {
    console.error('Image deletion error:', error);
    // Don't throw error for deletion
  }
};

// Validate file type and size
const validateFile = (file, allowedTypes = ['image'], maxSize = 5 * 1024 * 1024) => {
  const isAllowedType = allowedTypes.includes(file.mimetype.split('/')[0]);
  const isValidSize = file.size <= maxSize;

  return {
    isValid: isAllowedType && isValidSize,
    error: !isAllowedType ? `File type ${file.mimetype} is not allowed` :
           !isValidSize ? `File size exceeds limit of ${maxSize / (1024 * 1024)}MB` : null
  };
};

// Generate file URL (for local files)
const getFileUrl = (filePath, req) => {
  if (!filePath) return null;

  if (filePath.startsWith('http')) {
    return filePath; // Already a URL (Cloudinary)
  }

  const protocol = req.protocol;
  const host = req.get('host');
  return `${protocol}://${host}${filePath}`;
};

// File info extractor
const getFileInfo = (file) => {
  return {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    extension: path.extname(file.originalname).toLowerCase(),
    name: path.parse(file.originalname).name
  };
};

// Upload service images with validation
const uploadServiceImages = async (files) => {
  try {
    if (!files || files.length === 0) {
      return [];
    }

    if (files.length > 5) {
      throw new Error('Maximum 5 images allowed');
    }

    // Validate all files
    for (const file of files) {
      const validation = validateFile(file, ['image'], 5 * 1024 * 1024);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
    }

    const uploadedUrls = await uploadImages(files, 'services');
    return uploadedUrls;
  } catch (error) {
    console.error('Service images upload error:', error);
    throw error;
  }
};

// Upload avatar with validation
const uploadAvatar = async (file) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    const validation = validateFile(file, ['image'], 2 * 1024 * 1024);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    // Validate image dimensions (optional)
    const { createCanvas, loadImage } = require('canvas');
    const image = await loadImage(file.buffer);

    if (image.width < 100 || image.height < 100) {
      throw new Error('Image must be at least 100x100 pixels');
    }

    if (image.width > 2000 || image.height > 2000) {
      throw new Error('Image must not exceed 2000x2000 pixels');
    }

    const imageUrl = await uploadImage(file, 'avatars');
    return imageUrl;
  } catch (error) {
    console.error('Avatar upload error:', error);
    throw error;
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
  uploadImage,
  uploadImages,
  uploadServiceImages,
  uploadAvatar,
  deleteImage,
  deleteFile,
  validateFile,
  getFileInfo,
  getFileUrl
};