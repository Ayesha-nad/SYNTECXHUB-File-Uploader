const mongoose = require('mongoose');
const { initGridFSBucket, isMemoryStorageActive } = require('./gridfs');

let isDbConnected = false;
let isFallbackMode = false;

/**
 * Connects Mongoose to MongoDB. If no external MongoDB daemon is detected,
 * activates the built-in storage engine so the app works out-of-the-box.
 */
async function connectDB(customUri = null) {
  if (isDbConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const uri = customUri || process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/file_uploader_db';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
      autoIndex: true
    });

    isDbConnected = true;
    isFallbackMode = false;
    console.log(`[MongoDB] Connected successfully: ${conn.connection.host}/${conn.connection.name}`);

    // Initialize Native GridFS Bucket
    initGridFSBucket(conn.connection.db);

    mongoose.connection.on('error', (err) => {
      console.error(`[MongoDB Error] ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from database');
      isDbConnected = false;
    });

    return conn.connection;
  } catch (error) {
    console.warn(`[MongoDB] Local/Remote MongoDB not reachable at "${uri}" (${error.message}).`);
    console.log(`[GridFS Engine] Activated built-in GridFS storage engine for seamless standalone operation!`);
    isDbConnected = true;
    isFallbackMode = true;
    return null;
  }
}

/**
 * Disconnects Mongoose connection
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    isDbConnected = false;
    isFallbackMode = false;
    console.log('[MongoDB] Connection closed');
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  getConnection: () => mongoose.connection,
  isConnected: () => isDbConnected,
  isFallbackMode: () => isFallbackMode
};
