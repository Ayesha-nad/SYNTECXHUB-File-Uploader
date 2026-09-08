const multer = require('multer');
const { isMimeTypeAllowed, getAllowedMimeTypes } = require('../utils/fileValidators');

// Configure Memory Storage so we can stream into GridFS with complete validation
const storage = multer.memoryStorage();

/**
 * Calculates max file size limit in bytes from environment variable
 */
function getMaxFileSize() {
  const maxMb = parseFloat(process.env.MAX_FILE_SIZE_MB) || 10;
  return maxMb * 1024 * 1024;
}

/**
 * Custom Multer File Filter: Checks if incoming file MIME type is allowed
 */
const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(null, false);
  }

  const mimeType = file.mimetype;
  if (isMimeTypeAllowed(mimeType)) {
    cb(null, true);
  } else {
    const error = new Error(`Unsupported file type: "${mimeType}". Allowed types include: images, PDFs, Office documents, plain text, and common archives.`);
    error.name = 'UnsupportedMediaTypeError';
    error.code = 'UNSUPPORTED_MEDIA_TYPE';
    error.statusCode = 415;
    error.mimetype = mimeType;
    error.allowedTypes = getAllowedMimeTypes();
    cb(error, false);
  }
};

/**
 * Multer instance configuration
 */
const upload = multer({
  storage,
  limits: {
    fileSize: getMaxFileSize(),
    files: 10 // Max 10 files per multi-upload batch
  },
  fileFilter
});

/**
 * Single File Upload Middleware (Field: 'file')
 */
const uploadSingle = upload.single('file');

/**
 * Multi File Upload Middleware (Accepts field 'files[]' or 'files')
 */
const uploadMultiple = upload.fields([
  { name: 'files[]', maxCount: 10 },
  { name: 'files', maxCount: 10 }
]);

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  getMaxFileSize
};
