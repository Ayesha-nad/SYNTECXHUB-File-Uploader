const express = require('express');
const router = express.Router();

const {
  uploadSingle,
  uploadMultiple
} = require('../middleware/multerConfig');

const {
  uploadSingleFile,
  uploadMultipleFiles,
  listFiles,
  getFileById,
  getFileInfo,
  deleteFile,
  getStorageStats
} = require('../controllers/fileController');

/**
 * @route   POST /api/files/upload
 * @desc    Upload single file to MongoDB GridFS
 * @access  Public
 */
router.post('/upload', uploadSingle, uploadSingleFile);

/**
 * @route   POST /api/files/upload-multiple
 * @desc    Upload multiple files to MongoDB GridFS
 * @access  Public
 */
router.post('/upload-multiple', uploadMultiple, uploadMultipleFiles);

/**
 * @route   GET /api/files
 * @desc    List all files with pagination, search and filters
 * @access  Public
 */
router.get('/', listFiles);

/**
 * @route   GET /api/files/stats/summary
 * @desc    Get storage statistics and breakdown
 * @access  Public
 */
router.get('/stats/summary', getStorageStats);

/**
 * @route   GET /api/files/:id/info
 * @desc    Get file metadata only
 * @access  Public
 */
router.get('/:id/info', getFileInfo);

/**
 * @route   GET /api/files/:id
 * @desc    Stream or download file by GridFS ObjectId
 * @access  Public
 */
router.get('/:id', getFileById);

/**
 * @route   DELETE /api/files/:id
 * @desc    Delete file metadata and all GridFS chunks
 * @access  Public
 */
router.delete('/:id', deleteFile);

module.exports = router;
