const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MAX_FILE_SIZE_MB = '10';

const { app } = require('../server/server');
const { clearMockStore } = require('../server/config/gridfs');

let createdFileId = null;

test.before(() => {
  clearMockStore();
});

test('1. GET /api/health - Health check endpoint', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
  assert.strictEqual(res.body.service, 'File Uploader API (Multer + MongoDB GridFS)');
});

test('2. POST /api/files/upload - Successful Single File Upload', async () => {
  const sampleContent = Buffer.from('Hello GridFS and Multer! This is a test document text.');
  
  const res = await request(app)
    .post('/api/files/upload')
    .attach('file', sampleContent, 'sample_doc.txt')
    .field('uploadedBy', 'Automated Tester')
    .field('description', 'Unit test single upload');

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.file);
  assert.ok(res.body.file.id);
  assert.strictEqual(res.body.file.originalName, 'sample_doc.txt');
  assert.strictEqual(res.body.file.contentType, 'text/plain');
  assert.strictEqual(res.body.file.metadata.uploadedBy, 'Automated Tester');

  // Save for subsequent tests
  createdFileId = res.body.file.id;
});

test('3. POST /api/files/upload-multiple - Successful Multi-File Upload', async () => {
  const file1 = Buffer.from('%PDF-1.4 Mock PDF Binary Data');
  const file2 = Buffer.from('Name,Email\nJohn,john@example.com\nJane,jane@example.com');

  const res = await request(app)
    .post('/api/files/upload-multiple')
    .attach('files[]', file1, { filename: 'sample_report.pdf', contentType: 'application/pdf' })
    .attach('files[]', file2, { filename: 'users_data.csv', contentType: 'text/csv' })
    .field('uploadedBy', 'Batch Tester');

  assert.strictEqual(res.status, 201);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.uploadedCount, 2);
  assert.strictEqual(res.body.files.length, 2);
});

test('4. POST /api/files/upload - Error when no file is provided (400)', async () => {
  const res = await request(app)
    .post('/api/files/upload')
    .field('uploadedBy', 'Empty Tester');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'NO_FILE_PROVIDED');
});

test('5. POST /api/files/upload - Error on Disallowed MIME / Extension (415)', async () => {
  const executableBuffer = Buffer.from('MZ\x90\x00\x03\x00\x00\x00');

  const res = await request(app)
    .post('/api/files/upload')
    .attach('file', executableBuffer, { filename: 'malicious.exe', contentType: 'application/x-msdownload' });

  assert.strictEqual(res.status, 415);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'UNSUPPORTED_MEDIA_TYPE');
});

test('6. GET /api/files - List Files with Pagination', async () => {
  const res = await request(app).get('/api/files?page=1&limit=5');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.pagination);
  assert.ok(res.body.pagination.totalFiles >= 3);
  assert.ok(Array.isArray(res.body.files));
});

test('7. GET /api/files/:id/info - Fetch File Metadata by ID', async () => {
  assert.ok(createdFileId, 'createdFileId must exist');

  const res = await request(app).get(`/api/files/${createdFileId}/info`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.file.id, createdFileId);
  assert.strictEqual(res.body.file.originalName, 'sample_doc.txt');
  assert.ok(res.body.gridfs);
  assert.ok(res.body.gridfs.totalChunks >= 1);
});

test('8. GET /api/files/:id - Stream File (Inline View)', async () => {
  assert.ok(createdFileId, 'createdFileId must exist');

  const res = await request(app).get(`/api/files/${createdFileId}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers['content-type'], 'text/plain');
  assert.strictEqual(res.headers['accept-ranges'], 'bytes');
  assert.ok(res.headers['content-disposition'].includes('inline'));
  assert.ok(res.text.includes('Hello GridFS and Multer!'));
});

test('9. GET /api/files/:id?download=true - Download File (Attachment)', async () => {
  assert.ok(createdFileId, 'createdFileId must exist');

  const res = await request(app).get(`/api/files/${createdFileId}?download=true`);

  assert.strictEqual(res.status, 200);
  assert.ok(res.headers['content-disposition'].includes('attachment'));
});

test('10. GET /api/files/stats/summary - Storage Statistics', async () => {
  const res = await request(app).get('/api/files/stats/summary');

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.ok(res.body.stats);
  assert.ok(res.body.stats.totalFiles >= 3);
  assert.ok(res.body.stats.totalChunks >= 3);
  assert.ok(res.body.stats.totalStorageBytes > 0);
});

test('11. DELETE /api/files/:id - Delete File and Chunks from GridFS', async () => {
  assert.ok(createdFileId, 'createdFileId must exist');

  const res = await request(app).delete(`/api/files/${createdFileId}`);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.success, true);
  assert.strictEqual(res.body.id, createdFileId);
});

test('12. GET /api/files/:id - Verify Deleted File returns 404', async () => {
  assert.ok(createdFileId, 'createdFileId must exist');

  const res = await request(app).get(`/api/files/${createdFileId}`);

  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'FILE_NOT_FOUND');
});

test('13. GET /api/files/:id - Invalid ObjectId returns 400', async () => {
  const res = await request(app).get('/api/files/invalid-non-mongo-id');

  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.body.success, false);
  assert.strictEqual(res.body.code, 'INVALID_FILE_ID');
});
