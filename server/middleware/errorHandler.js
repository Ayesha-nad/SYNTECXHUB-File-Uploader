const multer = require('multer');
const { formatBytes } = require('../utils/fileValidators');
const { getMaxFileSize } = require('./multerConfig');

/**
 * Centralized Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_SERVER_ERROR';
  let message = err.message || 'An unexpected internal server error occurred';
  let details = null;

  // 1. Handle Multer Specific Errors
  if (err instanceof multer.MulterError) {
    switch (err.code) {
      case 'LIMIT_FILE_SIZE':
        statusCode = 413;
        code = 'FILE_TOO_LARGE';
        message = `File exceeds the ${formatBytes(getMaxFileSize())} size limit`;
        break;

      case 'LIMIT_FILE_COUNT':
        statusCode = 400;
        code = 'TOO_MANY_FILES';
        message = 'Exceeded maximum number of allowed files in a single request (Max: 10)';
        break;

      case 'LIMIT_UNEXPECTED_FILE':
        statusCode = 400;
        code = 'UNEXPECTED_FIELD';
        message = `Unexpected upload field "${err.field}". Expected "file" for single upload or "files[]" / "files" for multiple uploads.`;
        break;

      default:
        statusCode = 400;
        code = `MULTER_${err.code}`;
        message = err.message;
        break;
    }
  }

  // 2. Handle Unsupported Media Type Error
  if (err.name === 'UnsupportedMediaTypeError' || err.code === 'UNSUPPORTED_MEDIA_TYPE') {
    statusCode = 415;
    code = 'UNSUPPORTED_MEDIA_TYPE';
    message = err.message || 'File type is not supported';
    if (err.allowedTypes) {
      details = { allowedTypes: err.allowedTypes };
    }
  }

  // 3. Handle Mongoose / BSON Cast Errors (Invalid ObjectId)
  if (err.name === 'CastError' && err.kind === 'ObjectId') {
    statusCode = 400;
    code = 'INVALID_FILE_ID';
    message = `Invalid MongoDB ObjectId: "${err.value}"`;
  }

  // 4. Handle Custom Bad Request / Not Found Errors
  if (err.code === 'INVALID_FILE_ID') {
    statusCode = 400;
  } else if (err.code === 'NO_FILE_PROVIDED') {
    statusCode = 400;
  } else if (err.code === 'FILE_NOT_FOUND') {
    statusCode = 404;
  }

  // Construct standard error payload
  const errorResponse = {
    success: false,
    message,
    code
  };

  // Include extra debug details in non-production mode if available
  if (details && process.env.NODE_ENV !== 'production') {
    errorResponse.details = details;
  }

  // Log server-side 500 errors
  if (statusCode >= 500) {
    console.error(`[Server Error 500] ${err.stack || err.message}`);
  }

  return res.status(statusCode).json(errorResponse);
}

/**
 * 404 Not Found Middleware for unhandled routes
 */
function notFoundHandler(req, res, next) {
  return res.status(404).json({
    success: false,
    message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
    code: 'ROUTE_NOT_FOUND'
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
