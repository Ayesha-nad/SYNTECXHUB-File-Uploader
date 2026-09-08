const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const { connectDB, isConnected, isFallbackMode } = require('./config/db');
const fileRoutes = require('./routes/fileRoutes');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 5000;

// Security & Middlewares
app.use(helmet({
  contentSecurityPolicy: false, // Allows media & script loading for frontend dashboard
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin === '*' ? true : corsOrigin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Range']
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend dashboard
app.use(express.static(path.join(__dirname, '../public')));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const connected = isConnected();
  const fallback = isFallbackMode();
  res.status(200).json({
    status: 'ok',
    service: 'File Uploader API (Multer + MongoDB GridFS)',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      status: connected ? 'connected' : 'disconnected',
      mode: fallback ? 'standalone-gridfs' : 'mongodb-native',
      bucket: process.env.GRIDFS_BUCKET_NAME || 'uploads'
    }
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    name: 'File Uploader API',
    description: 'RESTful File Uploader API using Multer and MongoDB GridFS',
    endpoints: {
      uploadSingle: 'POST /api/files/upload',
      uploadMultiple: 'POST /api/files/upload-multiple',
      listFiles: 'GET /api/files',
      fileStats: 'GET /api/files/stats/summary',
      streamDownload: 'GET /api/files/:id',
      fileInfo: 'GET /api/files/:id/info',
      deleteFile: 'DELETE /api/files/:id',
      health: 'GET /api/health'
    }
  });
});

// Mount file management routes
app.use('/api/files', fileRoutes);

// Catch 404
app.use(notFoundHandler);

// Centralized error handler
app.use(errorHandler);

// Start Server helper
let serverInstance = null;

async function startServer() {
  await connectDB();

  serverInstance = app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 File Uploader Server is running on port: ${PORT}`);
    console.log(`🌐 Dashboard:   http://localhost:${PORT}`);
    console.log(`📡 API Base:    http://localhost:${PORT}/api/files`);
    console.log(`🩺 Health:      http://localhost:${PORT}/api/health`);
    console.log(`======================================================\n`);
  });

  return serverInstance;
}

// Handle unexpected termination
process.on('SIGINT', async () => {
  console.log('\nGracefully shutting down...');
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nGracefully shutting down...');
  if (serverInstance) serverInstance.close();
  process.exit(0);
});

// Auto start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = { app, startServer };
