# 🚀 File Uploader API (Multer + MongoDB GridFS)

A high-performance, production-ready **RESTful File Uploader API** built with **Node.js, Express, Multer, and MongoDB GridFS**. Files are streamed directly into MongoDB GridFS collections (`fs.files` and `fs.chunks`) without intermediate local disk writes, featuring chunking, MIME-type validation, size limits, HTTP Range streaming, metadata tracking, and an interactive modern web dashboard.

---

## 🌟 Key Features

- **Chunked Database Storage (GridFS)**: Files are automatically split into 255KB binary chunks across `uploads.files` (metadata) and `uploads.chunks` (binary data) collections.
- **Zero Disk Writes**: Memory-to-GridFS stream pipeline prevents server disk bloat and enables horizontal scaling.
- **MIME Whitelist Validation**: Strict validation against dangerous file types (images, PDFs, Office documents, archives, and text allowed; executable files rejected before streaming).
- **Configurable Size Limits**: Configurable via `.env` (default: 10MB) with `413 Payload Too Large` responses.
- **HTTP Range & Streaming**: Full support for `Accept-Ranges: bytes` and `Range` headers for seeking media (audio/video) and resuming large file downloads.
- **Safe Collision-Proof Filenames**: Hashes filenames using timestamp and crypto-random bytes while preserving original user filenames in metadata.
- **Interactive Modern Dashboard**: Built-in glassmorphism web dashboard featuring drag-and-drop uploads, real-time upload progress bars, inline previews (images, PDFs, media), search, and pagination.
- **Automated Test Suite**: End-to-end unit and integration tests covering all HTTP status codes (`200`, `201`, `400`, `404`, `413`, `415`).
- **Postman Collection**: Ready-to-import Postman collection (`postman_collection.json`) with pre-configured assertions.

---

## 🏗️ Architecture & Folder Structure

```
File Uploader Task 2/
├── server/
│   ├── config/
│   │   ├── db.js              # Mongoose DB connection & lifecycle events
│   │   └── gridfs.js          # GridFSBucket initialization & streaming helpers
│   ├── controllers/
│   │   └── fileController.js  # Endpoints: upload, list, stream, info, delete, stats
│   ├── middleware/
│   │   ├── multerConfig.js    # Multer engine, size limits, and MIME filter
│   │   └── errorHandler.js    # Centralized error handler & standardized JSON
│   ├── routes/
│   │   └── fileRoutes.js      # Express REST route definitions
│   ├── utils/
│   │   ├── fileValidators.js  # Whitelists, ObjectId validation, formatters
│   │   └── apiResponse.js     # Standard JSON success & error shapes
│   ├── server.js              # Express app bootstrap & security middlewares
│   ├── .env                   # Environment configuration
│   └── .env.example           # Environment template
├── public/                    # Interactive Modern Web Dashboard
│   ├── index.html             # Web UI structure & components
│   ├── style.css              # Dark-mode glassmorphic design system
│   └── app.js                 # Drag & drop, XHR progress, pagination, previews
├── test/
│   └── fileApi.test.js        # Automated API test suite
├── postman_collection.json    # Postman v2.1 collection export
├── package.json               # Dependencies & scripts
└── README.md                  # Comprehensive Documentation
```

---

## 🛠️ Tech Stack

- **Runtime**: Node.js (v18+)
- **Framework**: Express.js
- **Database**: MongoDB & Mongoose
- **Storage Engine**: Native `mongodb.GridFSBucket`
- **File Parser**: Multer
- **Security & Headers**: Helmet, CORS
- **Testing**: Node Native Test Runner + Supertest + `mongodb-memory-server`

---

## ⚙️ Environment Variables (`server/.env`)

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | Port for the Express HTTP server |
| `NODE_ENV` | `development` | Environment mode (`development`, `production`, `test`) |
| `MONGO_URI` | `mongodb://127.0.0.1:27017/file_uploader_db` | MongoDB connection URI (local or Atlas) |
| `GRIDFS_BUCKET_NAME` | `uploads` | GridFS Bucket name (creates `uploads.files` and `uploads.chunks`) |
| `MAX_FILE_SIZE_MB` | `10` | Maximum allowed file size in Megabytes |
| `ALLOWED_MIME_TYPES` | *See default list* | Comma-separated list of whitelisted MIME types |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) running locally or a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster.

### 2. Installation
```bash
# Clone the repository / open directory
cd "File Uploader Task 2"

# Install all dependencies
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` if not already present:
```bash
cp server/.env.example server/.env
```

### 4. Start Server

#### Development Mode (with auto-reload):
```bash
npm run dev
```

#### Production Mode:
```bash
npm start
```

The server will start at **`http://localhost:5000`**.

### 5. Run Automated Tests
```bash
npm test
```

---

## 🌐 Interactive Web Dashboard

Open **`http://localhost:5000`** in any web browser to access the Web Dashboard:
- 📤 **Drag & Drop Upload Zone**: Single and multi-file uploads with live byte-level progress bars.
- 🖼️ **Live Preview**: Inline previews for images, PDFs, audio, video, and text files.
- 🔍 **Search & Filters**: Instant search by filename/description, category chips (Images, PDFs, Docs, Archives, etc.), and sort order.
- 📊 **Real-time Storage Metrics**: Live counts of total files, binary chunks in GridFS, and storage consumed.
- 📋 **Direct Link Copy & Download**: Instant stream links and one-click download buttons.
- 🗑️ **Safe Deletion**: Confirmation modal before purging files from GridFS.

---

## 📡 API Reference & Endpoints

### 1. Upload Single File
- **Method**: `POST`
- **Endpoint**: `/api/files/upload`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `file` (File, required) — The file to upload
  - `uploadedBy` (Text, optional) — Uploader username or ID
  - `description` (Text, optional) — Description or notes

#### Sample Response (`201 Created`):
```json
{
  "success": true,
  "message": "File uploaded successfully",
  "file": {
    "id": "673f1a2b3c4d5e6f7a8b9c0d",
    "filename": "1725782400000-a1b2c3d4e5f6-sample_report.pdf",
    "originalName": "sample_report.pdf",
    "contentType": "application/pdf",
    "size": 245678,
    "uploadDate": "2026-09-08T10:00:00.000Z",
    "metadata": {
      "originalName": "sample_report.pdf",
      "contentType": "application/pdf",
      "size": 245678,
      "category": "pdf",
      "uploadedBy": "John Doe",
      "description": "Monthly Financial Report"
    },
    "urls": {
      "view": "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d",
      "download": "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d?download=true",
      "info": "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d/info"
    }
  }
}
```

---

### 2. Upload Multiple Files
- **Method**: `POST`
- **Endpoint**: `/api/files/upload-multiple`
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `files[]` or `files` (Multiple Files, required)
  - `uploadedBy` (Text, optional)

#### Sample Response (`201 Created`):
```json
{
  "success": true,
  "message": "2 file(s) uploaded successfully",
  "uploadedCount": 2,
  "totalBatchSize": 1048576,
  "totalBatchSizeFormatted": "1.00 MB",
  "files": [ ... ]
}
```

---

### 3. List Files (With Pagination & Filters)
- **Method**: `GET`
- **Endpoint**: `/api/files`
- **Query Parameters**:
  - `page` (Number, default: `1`): Page number
  - `limit` (Number, default: `10`, max: `100`): Items per page
  - `search` (String, optional): Filter by filename or description
  - `category` (String, optional): Filter by `image`, `pdf`, `document`, `archive`, `text`, `media`
  - `contentType` (String, optional): Filter by exact MIME type
  - `sortBy` (String, default: `uploadDate`): `uploadDate`, `length`, `filename`
  - `order` (String, default: `desc`): `asc` or `desc`

#### Sample Response (`200 OK`):
```json
{
  "success": true,
  "pagination": {
    "totalFiles": 45,
    "totalPages": 5,
    "currentPage": 1,
    "limit": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  },
  "files": [ ... ]
}
```

---

### 4. Stream / Download File by ID
- **Method**: `GET`
- **Endpoint**: `/api/files/:id`
- **Query Parameters**:
  - `download=true` (optional): Forces browser download via `Content-Disposition: attachment`.
- **Behaviors**:
  - Serves inline for images, PDFs, text, audio, and video.
  - Supports HTTP Range requests (`206 Partial Content`) for video playback and download resume.

---

### 5. Get File Metadata Only
- **Method**: `GET`
- **Endpoint**: `/api/files/:id/info`

#### Sample Response (`200 OK`):
```json
{
  "success": true,
  "file": {
    "id": "673f1a2b3c4d5e6f7a8b9c0d",
    "filename": "1725782400000-a1b2c3d4e5f6-avatar.png",
    "originalName": "avatar.png",
    "contentType": "image/png",
    "size": 524288,
    "uploadDate": "2026-09-08T10:00:00.000Z",
    "metadata": { ... },
    "urls": { ... }
  },
  "gridfs": {
    "bucketName": "uploads",
    "chunkSizeBytes": 261120,
    "totalChunks": 2,
    "md5": null
  }
}
```

---

### 6. Delete File by ID
- **Method**: `DELETE`
- **Endpoint**: `/api/files/:id`

#### Sample Response (`200 OK`):
```json
{
  "success": true,
  "message": "File deleted successfully",
  "id": "673f1a2b3c4d5e6f7a8b9c0d",
  "deletedFilename": "1725782400000-a1b2c3d4e5f6-sample.pdf",
  "originalName": "sample.pdf"
}
```

---

### 7. Storage Statistics Summary
- **Method**: `GET`
- **Endpoint**: `/api/files/stats/summary`

#### Sample Response (`200 OK`):
```json
{
  "success": true,
  "stats": {
    "totalFiles": 18,
    "totalChunks": 42,
    "totalStorageBytes": 10485760,
    "totalStorageFormatted": "10.00 MB",
    "avgFileSizeFormatted": "582.54 KB",
    "maxFileSizeFormatted": "4.20 MB",
    "categories": [
      { "category": "image", "count": 10, "sizeFormatted": "6.50 MB" },
      { "category": "pdf", "count": 5, "sizeFormatted": "2.80 MB" }
    ]
  }
}
```

---

### 8. System Health Check
- **Method**: `GET`
- **Endpoint**: `/api/health`

---

## 🛡️ Error Handling & Status Codes

All errors return a uniform, standardized JSON error structure:

```json
{
  "success": false,
  "message": "File exceeds the 10.00 MB size limit",
  "code": "FILE_TOO_LARGE"
}
```

| HTTP Status | Error Code | Description |
| :--- | :--- | :--- |
| `400 Bad Request` | `NO_FILE_PROVIDED` | Upload request contains no file attached to `file` or `files[]` field |
| `400 Bad Request` | `INVALID_FILE_ID` | File ID in URL param is not a valid 24-character hexadecimal ObjectId |
| `400 Bad Request` | `UNEXPECTED_FIELD` | Multipart form-data field name does not match expected field |
| `404 Not Found` | `FILE_NOT_FOUND` | File ID does not exist in `uploads.files` |
| `404 Not Found` | `ROUTE_NOT_FOUND` | API route does not exist |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | File exceeds the maximum allowed size configured in `.env` |
| `415 Unsupported Media Type` | `UNSUPPORTED_MEDIA_TYPE` | Uploaded file MIME type is not permitted in whitelist |
| `500 Internal Server Error` | `INTERNAL_SERVER_ERROR` | Database or streaming failure (stack traces concealed in production) |

---

## 💻 cURL Examples

```bash
# 1. Single File Upload
curl -X POST http://localhost:5000/api/files/upload \
  -F "file=@/path/to/document.pdf" \
  -F "uploadedBy=Alice" \
  -F "description=Quarterly Report"

# 2. Multi-File Upload
curl -X POST http://localhost:5000/api/files/upload-multiple \
  -F "files[]=@/path/to/image1.png" \
  -F "files[]=@/path/to/image2.png"

# 3. List Files with Search & Filter
curl -X GET "http://localhost:5000/api/files?category=pdf&search=report&page=1&limit=5"

# 4. Download File
curl -X GET "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d?download=true" -o downloaded_file.pdf

# 5. Inspect Metadata
curl -X GET "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d/info"

# 6. Delete File
curl -X DELETE "http://localhost:5000/api/files/673f1a2b3c4d5e6f7a8b9c0d"
```

---

## 🧪 Postman Collection

The file **`postman_collection.json`** is located in the root directory.

### How to Import & Run:
1. Open **Postman**.
2. Click **Import** (top left).
3. Select `postman_collection.json` from the repository root.
4. Set the `baseUrl` collection variable to `http://localhost:5000`.
5. Run requests or use the **Collection Runner** to execute the full automated test suite!

---

## 📜 License
MIT License. Built for Syntecxhub Web Development Task 2.
