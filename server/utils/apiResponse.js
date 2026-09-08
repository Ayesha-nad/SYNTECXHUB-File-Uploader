/**
 * Standard API Response Formatting Utilities
 */

/**
 * Formats a successful response
 */
function sendSuccess(res, statusCode = 200, data = {}, message = null) {
  const payload = {
    success: true,
    ...data
  };
  if (message) {
    payload.message = message;
  }
  return res.status(statusCode).json(payload);
}

/**
 * Formats an error response
 */
function sendError(res, statusCode = 500, message = 'Internal Server Error', code = 'INTERNAL_SERVER_ERROR', details = null) {
  const payload = {
    success: false,
    message,
    code
  };
  if (details && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  return res.status(statusCode).json(payload);
}

/**
 * Formats a file document for API output
 */
function formatFileResponse(fileDoc, req = null) {
  if (!fileDoc) return null;

  const id = fileDoc._id ? fileDoc._id.toString() : fileDoc.id;
  const originalName = fileDoc.metadata?.originalName || fileDoc.filename;
  const contentType = fileDoc.contentType || fileDoc.metadata?.contentType || 'application/octet-stream';
  const size = fileDoc.length !== undefined ? fileDoc.length : (fileDoc.size || 0);

  // Construct absolute/relative URLs if request object is provided
  const baseUrl = req ? `${req.protocol}://${req.get('host')}` : '';
  const viewUrl = `${baseUrl}/api/files/${id}`;
  const downloadUrl = `${baseUrl}/api/files/${id}?download=true`;
  const infoUrl = `${baseUrl}/api/files/${id}/info`;

  return {
    id,
    filename: fileDoc.filename,
    originalName,
    contentType,
    size,
    uploadDate: fileDoc.uploadDate,
    metadata: {
      originalName,
      uploadedBy: fileDoc.metadata?.uploadedBy || 'anonymous',
      description: fileDoc.metadata?.description || '',
      category: fileDoc.metadata?.category || 'other',
      ...fileDoc.metadata
    },
    urls: {
      view: viewUrl,
      download: downloadUrl,
      info: infoUrl
    }
  };
}

module.exports = {
  sendSuccess,
  sendError,
  formatFileResponse
};
