const mongoose = require('mongoose');
const path = require('path');
const crypto = require('crypto');

/**
 * Default Whitelisted MIME Types
 */
const DEFAULT_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/bmp',
  // Documents & PDFs
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Plain Text & Code
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-rar-compressed',
  'application/x-tar',
  'application/gzip',
  'application/x-7z-compressed',
  // Audio & Video
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/webm',
  'video/quicktime'
];

/**
 * Returns allowed MIME types array from environment or defaults
 */
function getAllowedMimeTypes() {
  if (process.env.ALLOWED_MIME_TYPES && process.env.ALLOWED_MIME_TYPES.trim()) {
    return process.env.ALLOWED_MIME_TYPES.split(',').map(type => type.trim().toLowerCase());
  }
  return DEFAULT_ALLOWED_MIME_TYPES;
}

/**
 * Validates if given MIME type is permitted
 */
function isMimeTypeAllowed(mimeType) {
  if (!mimeType) return false;
  const allowed = getAllowedMimeTypes();
  const normalized = mimeType.toLowerCase();
  return allowed.includes(normalized) || allowed.includes('*/*');
}

/**
 * Validates whether a string is a 24-character hexadecimal MongoDB ObjectId
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && new mongoose.Types.ObjectId(id).toString() === id;
}

/**
 * Formats byte size to human-readable string (KB, MB, GB)
 */
function formatBytes(bytes, decimals = 2) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Determines file category from MIME type
 */
function getFileCategory(mimeType) {
  if (!mimeType) return 'other';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('officedocument.word')) return 'document';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet') || mimeType.includes('csv')) return 'spreadsheet';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'presentation';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed') || mimeType.includes('gzip')) return 'archive';
  if (mimeType.startsWith('text/')) return 'text';
  return 'other';
}

/**
 * Generates a collision-proof safe filename:
 * <timestamp>-<16-char-random-hex><sanitized-ext>
 */
function generateSafeFilename(originalName) {
  const timestamp = Date.now();
  const randomHash = crypto.randomBytes(8).toString('hex');
  const ext = path.extname(originalName || '').toLowerCase().replace(/[^a-z0-9.]/gi, '');
  const baseName = path.basename(originalName || 'file', ext)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gi, '_')
    .substring(0, 30);

  return `${timestamp}-${randomHash}-${baseName}${ext}`;
}

module.exports = {
  DEFAULT_ALLOWED_MIME_TYPES,
  getAllowedMimeTypes,
  isMimeTypeAllowed,
  isValidObjectId,
  formatBytes,
  getFileCategory,
  generateSafeFilename
};
