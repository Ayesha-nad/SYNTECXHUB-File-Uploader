const mongoose = require('mongoose');
const {
  getGridFSBucket,
  getFilesCollection,
  getChunksCollection,
  uploadBufferToGridFS,
  getFileMetadataById,
  deleteGridFSFile
} = require('../config/gridfs');
const {
  isValidObjectId,
  generateSafeFilename,
  getFileCategory,
  formatBytes
} = require('../utils/fileValidators');
const {
  sendSuccess,
  sendError,
  formatFileResponse
} = require('../utils/apiResponse');

/**
 * Controller: Upload Single File
 * Endpoint: POST /api/files/upload
 */
async function uploadSingleFile(req, res, next) {
  try {
    if (!req.file) {
      return sendError(res, 400, "No file provided in request. Field name must be 'file'", 'NO_FILE_PROVIDED');
    }

    const { originalname, mimetype, buffer, size } = req.file;
    const safeFilename = generateSafeFilename(originalname);
    const category = getFileCategory(mimetype);

    // Build rich metadata
    const metadata = {
      originalName: originalname,
      contentType: mimetype,
      size,
      category,
      uploadedBy: req.body.uploadedBy || 'anonymous',
      description: req.body.description ? String(req.body.description).trim() : '',
      tags: req.body.tags ? String(req.body.tags).split(',').map(t => t.trim()).filter(Boolean) : []
    };

    // Stream buffer into GridFS
    const savedDoc = await uploadBufferToGridFS(buffer, safeFilename, {
      contentType: mimetype,
      metadata
    });

    const fileResponse = formatFileResponse(savedDoc, req);

    return sendSuccess(res, 201, { file: fileResponse }, 'File uploaded successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Upload Multiple Files
 * Endpoint: POST /api/files/upload-multiple
 */
async function uploadMultipleFiles(req, res, next) {
  try {
    // Check files array from fields
    let files = [];
    if (req.files) {
      if (Array.isArray(req.files['files[]'])) {
        files = req.files['files[]'];
      } else if (Array.isArray(req.files['files'])) {
        files = req.files['files'];
      } else if (Array.isArray(req.files)) {
        files = req.files;
      }
    }

    if (!files || files.length === 0) {
      return sendError(res, 400, "No files provided in request. Field name must be 'files[]' or 'files'", 'NO_FILE_PROVIDED');
    }

    const uploadedFiles = [];
    let totalBatchSize = 0;

    for (const file of files) {
      const { originalname, mimetype, buffer, size } = file;
      const safeFilename = generateSafeFilename(originalname);
      const category = getFileCategory(mimetype);

      const metadata = {
        originalName: originalname,
        contentType: mimetype,
        size,
        category,
        uploadedBy: req.body.uploadedBy || 'anonymous',
        description: req.body.description ? String(req.body.description).trim() : ''
      };

      const savedDoc = await uploadBufferToGridFS(buffer, safeFilename, {
        contentType: mimetype,
        metadata
      });

      totalBatchSize += size;
      uploadedFiles.push(formatFileResponse(savedDoc, req));
    }

    return sendSuccess(res, 201, {
      uploadedCount: uploadedFiles.length,
      totalBatchSize,
      totalBatchSizeFormatted: formatBytes(totalBatchSize),
      files: uploadedFiles
    }, `${uploadedFiles.length} file(s) uploaded successfully`);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: List Files with Pagination, Search, and Filtering
 * Endpoint: GET /api/files
 */
async function listFiles(req, res, next) {
  try {
    const filesCollection = getFilesCollection();

    // Query parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const searchQuery = req.query.search ? String(req.query.search).trim() : '';
    const category = req.query.category ? String(req.query.category).trim().toLowerCase() : '';
    const contentType = req.query.contentType ? String(req.query.contentType).trim() : '';
    const sortBy = req.query.sortBy || 'uploadDate';
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    // Build filter
    const filter = {};

    if (searchQuery) {
      filter.$or = [
        { filename: { $regex: searchQuery, $options: 'i' } },
        { 'metadata.originalName': { $regex: searchQuery, $options: 'i' } },
        { 'metadata.description': { $regex: searchQuery, $options: 'i' } }
      ];
    }

    if (category && category !== 'all') {
      filter['metadata.category'] = category;
    }

    if (contentType) {
      filter.contentType = contentType;
    }

    // Determine sort
    const sort = {};
    if (sortBy === 'size' || sortBy === 'length') {
      sort.length = sortOrder;
    } else if (sortBy === 'originalName' || sortBy === 'name') {
      sort['metadata.originalName'] = sortOrder;
    } else if (sortBy === 'filename') {
      sort.filename = sortOrder;
    } else {
      sort.uploadDate = sortOrder;
    }

    const [filesDocs, totalFiles] = await Promise.all([
      filesCollection.find(filter).sort(sort).skip(skip).limit(limit).toArray(),
      filesCollection.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalFiles / limit) || 1;
    const formattedFiles = filesDocs.map(doc => formatFileResponse(doc, req));

    return sendSuccess(res, 200, {
      pagination: {
        totalFiles,
        totalPages,
        currentPage: page,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      files: formattedFiles
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Stream / Download File by ID
 * Endpoint: GET /api/files/:id
 */
async function getFileById(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, `Invalid file ID: "${id}". Must be a 24-character hexadecimal ObjectId.`, 'INVALID_FILE_ID');
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const fileDoc = await getFileMetadataById(objectId);

    if (!fileDoc) {
      return sendError(res, 404, `File with ID "${id}" was not found`, 'FILE_NOT_FOUND');
    }

    const bucket = getGridFSBucket();
    const contentType = fileDoc.contentType || fileDoc.metadata?.contentType || 'application/octet-stream';
    const originalName = fileDoc.metadata?.originalName || fileDoc.filename;
    const fileSize = fileDoc.length;

    // Check if inline view or force download requested
    const forceDownload = req.query.download === 'true' || req.query.download === '1';
    const isInlineViewable = contentType.startsWith('image/') ||
      contentType === 'application/pdf' ||
      contentType.startsWith('text/') ||
      contentType.startsWith('video/') ||
      contentType.startsWith('audio/') ||
      contentType === 'application/json';

    const dispositionType = (!forceDownload && isInlineViewable) ? 'inline' : 'attachment';

    // RFC 5987 filename encoding for non-ASCII characters
    const encodedFilename = encodeURIComponent(originalName).replace(/['()]/g, escape).replace(/\*/g, '%2A');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${originalName.replace(/"/g, '')}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Last-Modified', new Date(fileDoc.uploadDate).toUTCString());

    // Handle HTTP Range Requests (Audio / Video / Resume Downloads)
    const rangeHeader = req.headers.range;
    if (rangeHeader && fileSize > 0) {
      const parts = rangeHeader.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

      if (start >= fileSize || end >= fileSize || start > end) {
        res.setHeader('Content-Range', `bytes */${fileSize}`);
        return res.status(416).send('Requested Range Not Satisfiable');
      }

      const chunkSize = (end - start) + 1;
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`);
      res.setHeader('Content-Length', chunkSize);

      const downloadStream = bucket.openDownloadStream(objectId, {
        start,
        end: end + 1
      });

      downloadStream.on('error', (err) => {
        if (!res.headersSent) {
          return sendError(res, 500, 'Error streaming file from GridFS', 'STREAM_ERROR');
        }
        res.end();
      });

      return downloadStream.pipe(res);
    }

    // Standard Full File Stream
    res.setHeader('Content-Length', fileSize);

    const downloadStream = bucket.openDownloadStream(objectId);

    downloadStream.on('error', (err) => {
      if (!res.headersSent) {
        return sendError(res, 500, 'Error streaming file from GridFS', 'STREAM_ERROR');
      }
      res.end();
    });

    return downloadStream.pipe(res);
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Get File Metadata Only
 * Endpoint: GET /api/files/:id/info
 */
async function getFileInfo(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, `Invalid file ID: "${id}". Must be a 24-character hexadecimal ObjectId.`, 'INVALID_FILE_ID');
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const fileDoc = await getFileMetadataById(objectId);

    if (!fileDoc) {
      return sendError(res, 404, `File with ID "${id}" was not found`, 'FILE_NOT_FOUND');
    }

    const chunkSize = fileDoc.chunkSize || (255 * 1024);
    const totalChunks = Math.ceil(fileDoc.length / chunkSize) || 1;

    const fileResponse = formatFileResponse(fileDoc, req);

    return sendSuccess(res, 200, {
      file: fileResponse,
      gridfs: {
        bucketName: process.env.GRIDFS_BUCKET_NAME || 'uploads',
        chunkSizeBytes: chunkSize,
        totalChunks,
        md5: fileDoc.md5 || null
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Delete File by ID
 * Endpoint: DELETE /api/files/:id
 */
async function deleteFile(req, res, next) {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return sendError(res, 400, `Invalid file ID: "${id}". Must be a 24-character hexadecimal ObjectId.`, 'INVALID_FILE_ID');
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const fileDoc = await getFileMetadataById(objectId);

    if (!fileDoc) {
      return sendError(res, 404, `File with ID "${id}" was not found`, 'FILE_NOT_FOUND');
    }

    // Delete removes both fs.files record and all associated chunks in fs.chunks
    await deleteGridFSFile(objectId);

    return sendSuccess(res, 200, {
      id,
      deletedFilename: fileDoc.filename,
      originalName: fileDoc.metadata?.originalName || fileDoc.filename
    }, 'File deleted successfully');
  } catch (error) {
    next(error);
  }
}

/**
 * Controller: Storage and System Statistics
 * Endpoint: GET /api/files/stats/summary
 */
async function getStorageStats(req, res, next) {
  try {
    const filesCollection = getFilesCollection();
    const chunksCollection = getChunksCollection();

    const [totalFiles, totalChunks, sizeAggregation] = await Promise.all([
      filesCollection.countDocuments(),
      chunksCollection.countDocuments(),
      filesCollection.aggregate([
        {
          $group: {
            _id: null,
            totalBytes: { $sum: '$length' },
            avgFileSize: { $avg: '$length' },
            maxFileSize: { $max: '$length' }
          }
        }
      ]).toArray()
    ]);

    const totalBytes = sizeAggregation[0]?.totalBytes || 0;
    const avgFileSize = sizeAggregation[0]?.avgFileSize || 0;
    const maxFileSize = sizeAggregation[0]?.maxFileSize || 0;

    // Aggregate by category
    const categoryBreakdown = await filesCollection.aggregate([
      {
        $group: {
          _id: '$metadata.category',
          count: { $sum: 1 },
          totalBytes: { $sum: '$length' }
        }
      }
    ]).toArray();

    return sendSuccess(res, 200, {
      stats: {
        totalFiles,
        totalChunks,
        totalStorageBytes: totalBytes,
        totalStorageFormatted: formatBytes(totalBytes),
        avgFileSizeFormatted: formatBytes(avgFileSize),
        maxFileSizeFormatted: formatBytes(maxFileSize),
        categories: categoryBreakdown.map(c => ({
          category: c._id || 'other',
          count: c.count,
          sizeFormatted: formatBytes(c.totalBytes)
        }))
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadSingleFile,
  uploadMultipleFiles,
  listFiles,
  getFileById,
  getFileInfo,
  deleteFile,
  getStorageStats
};
