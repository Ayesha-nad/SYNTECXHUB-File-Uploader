const mongoose = require('mongoose');
const { Readable, PassThrough } = require('stream');

let gridFSBucket = null;
let activeDb = null;
let currentBucketName = 'uploads';

// In-memory GridFS store for standalone mode / testing
const memoryFilesStore = new Map();

/**
 * Initializes the native MongoDB GridFSBucket
 */
function initGridFSBucket(db, bucketName = null) {
  if (!db) return null;

  currentBucketName = bucketName || process.env.GRIDFS_BUCKET_NAME || 'uploads';
  activeDb = db;
  gridFSBucket = new mongoose.mongo.GridFSBucket(db, {
    bucketName: currentBucketName,
    chunkSizeBytes: 255 * 1024 // 255KB standard GridFS chunk size
  });

  console.log(`[GridFS] Bucket initialized with name: "${currentBucketName}"`);
  return gridFSBucket;
}

/**
 * Gets the current active GridFSBucket or fallback stream provider
 */
function getGridFSBucket() {
  if (gridFSBucket && mongoose.connection.readyState === 1) {
    return gridFSBucket;
  }

  if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    return initGridFSBucket(mongoose.connection.db);
  }

  // Standalone GridFS Stream provider
  return {
    openDownloadStream: (id, options = {}) => {
      const doc = memoryFilesStore.get(id.toString());
      if (!doc) {
        const errStream = new PassThrough();
        process.nextTick(() => errStream.emit('error', new Error('File not found in GridFS store')));
        return errStream;
      }
      let buffer = doc.buffer || Buffer.alloc(0);
      if (options.start !== undefined || options.end !== undefined) {
        const start = options.start || 0;
        const end = options.end !== undefined ? options.end : buffer.length;
        buffer = buffer.subarray(start, end);
      }
      return Readable.from(buffer);
    },
    delete: async (id) => {
      memoryFilesStore.delete(id.toString());
      return true;
    }
  };
}

/**
 * Gets the GridFS files collection (<bucketName>.files)
 */
function getFilesCollection() {
  if (activeDb && mongoose.connection.readyState === 1) {
    return activeDb.collection(`${currentBucketName}.files`);
  }
  if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    activeDb = mongoose.connection.db;
    return activeDb.collection(`${currentBucketName}.files`);
  }

  // Standalone Query Engine
  return {
    find: (filter = {}) => ({
      sort: (sortSpec = {}) => ({
        skip: (skip = 0) => ({
          limit: (limit = 10) => ({
            toArray: async () => {
              let items = Array.from(memoryFilesStore.values());

              if (filter.contentType) {
                items = items.filter(i => i.contentType === filter.contentType);
              }
              if (filter['metadata.category']) {
                items = items.filter(i => i.metadata?.category === filter['metadata.category']);
              }
              if (filter.$or) {
                items = items.filter(i => {
                  return filter.$or.some(cond => {
                    if (cond.filename) {
                      const regex = new RegExp(cond.filename.$regex, cond.filename.$options || 'i');
                      return regex.test(i.filename);
                    }
                    if (cond['metadata.originalName']) {
                      const regex = new RegExp(cond['metadata.originalName'].$regex, cond['metadata.originalName'].$options || 'i');
                      return regex.test(i.metadata?.originalName || '');
                    }
                    if (cond['metadata.description']) {
                      const regex = new RegExp(cond['metadata.description'].$regex, cond['metadata.description'].$options || 'i');
                      return regex.test(i.metadata?.description || '');
                    }
                    return false;
                  });
                });
              }

              // Apply sorting
              if (sortSpec.length) {
                items.sort((a, b) => (a.length - b.length) * sortSpec.length);
              } else if (sortSpec.filename) {
                items.sort((a, b) => a.filename.localeCompare(b.filename) * sortSpec.filename);
              } else if (sortSpec['metadata.originalName']) {
                items.sort((a, b) => ((a.metadata?.originalName || '').localeCompare(b.metadata?.originalName || '')) * sortSpec['metadata.originalName']);
              } else {
                items.sort((a, b) => (new Date(b.uploadDate) - new Date(a.uploadDate)) * (sortSpec.uploadDate || -1));
              }

              return items.slice(skip, skip + limit);
            }
          })
        })
      })
    }),
    countDocuments: async (filter = {}) => {
      let items = Array.from(memoryFilesStore.values());
      if (filter.contentType) items = items.filter(i => i.contentType === filter.contentType);
      if (filter['metadata.category']) items = items.filter(i => i.metadata?.category === filter['metadata.category']);
      if (filter.$or) {
        items = items.filter(i => {
          return filter.$or.some(cond => {
            if (cond.filename) {
              const regex = new RegExp(cond.filename.$regex, cond.filename.$options || 'i');
              return regex.test(i.filename);
            }
            if (cond['metadata.originalName']) {
              const regex = new RegExp(cond['metadata.originalName'].$regex, cond['metadata.originalName'].$options || 'i');
              return regex.test(i.metadata?.originalName || '');
            }
            return false;
          });
        });
      }
      return items.length;
    },
    findOne: async (query) => {
      if (query._id) {
        return memoryFilesStore.get(query._id.toString()) || null;
      }
      return null;
    },
    aggregate: (pipeline = []) => ({
      toArray: async () => {
        const items = Array.from(memoryFilesStore.values());
        if (pipeline[0]?.$group?.totalBytes) {
          const totalBytes = items.reduce((sum, item) => sum + (item.length || 0), 0);
          return [{
            totalBytes,
            avgFileSize: items.length ? totalBytes / items.length : 0,
            maxFileSize: items.length ? Math.max(...items.map(i => i.length || 0)) : 0
          }];
        }
        if (pipeline[0]?.$group?._id === '$metadata.category') {
          const categories = {};
          items.forEach(i => {
            const cat = i.metadata?.category || 'other';
            if (!categories[cat]) categories[cat] = { count: 0, totalBytes: 0 };
            categories[cat].count++;
            categories[cat].totalBytes += (i.length || 0);
          });
          return Object.entries(categories).map(([k, v]) => ({ _id: k, count: v.count, totalBytes: v.totalBytes }));
        }
        return [];
      }
    })
  };
}

/**
 * Gets the GridFS chunks collection (<bucketName>.chunks)
 */
function getChunksCollection() {
  if (activeDb && mongoose.connection.readyState === 1) {
    return activeDb.collection(`${currentBucketName}.chunks`);
  }
  if (mongoose.connection && mongoose.connection.readyState === 1 && mongoose.connection.db) {
    activeDb = mongoose.connection.db;
    return activeDb.collection(`${currentBucketName}.chunks`);
  }

  return {
    countDocuments: async () => {
      let chunksCount = 0;
      memoryFilesStore.forEach(doc => {
        chunksCount += Math.ceil((doc.length || 1) / (doc.chunkSize || 255 * 1024));
      });
      return chunksCount;
    }
  };
}

/**
 * Uploads a memory buffer into GridFS via streaming
 */
function uploadBufferToGridFS(buffer, filename, options = {}) {
  // If native database is connected, use real GridFSBucket
  if (mongoose.connection && mongoose.connection.readyState === 1 && gridFSBucket) {
    return new Promise((resolve, reject) => {
      const bucket = getGridFSBucket();
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);

      const uploadStream = bucket.openUploadStream(filename, {
        contentType: options.contentType || 'application/octet-stream',
        metadata: options.metadata || {}
      });

      uploadStream.on('error', (error) => {
        reject(error);
      });

      uploadStream.on('finish', async (file) => {
        try {
          const filesCollection = getFilesCollection();
          const savedDoc = await filesCollection.findOne({ _id: file._id });
          resolve(savedDoc || file);
        } catch (err) {
          resolve(file);
        }
      });

      readableStream.pipe(uploadStream);
    });
  }

  // Standalone GridFS storage
  const objectId = new mongoose.Types.ObjectId();
  const chunkSize = 255 * 1024;
  const doc = {
    _id: objectId,
    filename,
    length: buffer ? buffer.length : 0,
    chunkSize,
    uploadDate: new Date(),
    contentType: options.contentType || 'application/octet-stream',
    metadata: options.metadata || {},
    buffer: buffer
  };
  memoryFilesStore.set(objectId.toString(), doc);
  return Promise.resolve(doc);
}

/**
 * Retrieves file metadata document by ObjectId
 */
async function getFileMetadataById(id) {
  const filesCollection = getFilesCollection();
  const objectId = typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  return await filesCollection.findOne({ _id: objectId });
}

/**
 * Deletes file and all associated chunks from GridFS
 */
async function deleteGridFSFile(id) {
  const bucket = getGridFSBucket();
  const objectId = typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
  await bucket.delete(objectId);
  memoryFilesStore.delete(objectId.toString());
  return true;
}

function clearMockStore() {
  memoryFilesStore.clear();
}

module.exports = {
  initGridFSBucket,
  getGridFSBucket,
  getFilesCollection,
  getChunksCollection,
  uploadBufferToGridFS,
  getFileMetadataById,
  deleteGridFSFile,
  clearMockStore
};
