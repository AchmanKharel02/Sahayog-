const express = require('express');
const router = express.Router();
const { uploadSingle, uploadMultiple, validateFile, getFileInfo } = require('../services/fileService');
const { authenticate } = require('../middleware/auth');

// Single image upload
router.post('/image', authenticate, uploadSingle('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const validation = validateFile(req.file, ['image'], 5 * 1024 * 1024);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { uploadImage } = require('../services/fileService');
    const imageUrl = await uploadImage(req.file, 'uploads');

    res.json({
      success: true,
      message: 'Image uploaded successfully',
      data: {
        url: imageUrl,
        info: getFileInfo(req.file)
      }
    });
  } catch (error) {
    console.error('Image upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload image'
    });
  }
});

// Multiple images upload
router.post('/images', authenticate, uploadMultiple('images'), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    if (req.files.length > 5) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 5 images allowed'
      });
    }

    // Validate all files
    for (const file of req.files) {
      const validation = validateFile(file, ['image'], 5 * 1024 * 1024);
      if (!validation.isValid) {
        return res.status(400).json({
          success: false,
          error: validation.error
        });
      }
    }

    const { uploadImages } = require('../services/fileService');
    const imageUrls = await uploadImages(req.files, 'uploads');

    res.json({
      success: true,
      message: 'Images uploaded successfully',
      data: {
        urls: imageUrls,
        count: imageUrls.length
      }
    });
  } catch (error) {
    console.error('Multiple images upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload images'
    });
  }
});

// Document upload
router.post('/document', authenticate, uploadSingle('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const validation = validateFile(req.file, ['document'], 10 * 1024 * 1024);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { uploadImage } = require('../services/fileService');
    const fileUrl = await uploadImage(req.file, 'documents');

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      data: {
        url: fileUrl,
        info: getFileInfo(req.file)
      }
    });
  } catch (error) {
    console.error('Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload document'
    });
  }
});

// Avatar upload
router.post('/avatar', authenticate, uploadSingle('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    const validation = validateFile(req.file, ['image'], 2 * 1024 * 1024);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: validation.error
      });
    }

    const { uploadAvatar } = require('../services/fileService');
    const avatarUrl = await uploadAvatar(req.file);

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        url: avatarUrl,
        info: getFileInfo(req.file)
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
});

// Delete file
router.delete('/file/:fileName', authenticate, async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = `/uploads/${fileName}`;

    const { deleteFile } = require('../services/fileService');
    await deleteFile(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('File deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file'
    });
  }
});

module.exports = router;