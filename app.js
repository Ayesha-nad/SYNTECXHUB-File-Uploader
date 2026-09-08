// GridFS File Uploader Dashboard Client Application
document.addEventListener('DOMContentLoaded', () => {
  const isGitHubPages = window.location.hostname.includes('github.io') || window.location.protocol === 'file:';

  // State
  let state = {
    files: [],
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalFiles: 0,
      limit: 12
    },
    currentCategory: 'all',
    searchQuery: '',
    currentView: 'grid',
    activeModalFile: null,
    fileToDeleteId: null,
    customApiBase: localStorage.getItem('gridfs_api_base') || ''
  };

  // Standalone GitHub Pages In-Memory & IndexedDB Storage
  const localDbFiles = JSON.parse(localStorage.getItem('gh_pages_gridfs_files') || '[]');

  // DOM Elements
  const healthDot = document.getElementById('healthDot');
  const healthText = document.getElementById('healthText');
  const statTotalFiles = document.getElementById('statTotalFiles');
  const statTotalStorage = document.getElementById('statTotalStorage');
  const statTotalChunks = document.getElementById('statTotalChunks');

  const dropZone = document.getElementById('dropZone');
  const fileInputSingle = document.getElementById('fileInputSingle');
  const fileInputMultiple = document.getElementById('fileInputMultiple');
  const btnBrowseSingle = document.getElementById('btnBrowseSingle');
  const btnBrowseMultiple = document.getElementById('btnBrowseMultiple');
  const uploaderNameInput = document.getElementById('uploaderNameInput');
  const fileDescInput = document.getElementById('fileDescInput');

  const uploadQueue = document.getElementById('uploadQueue');
  const queueItems = document.getElementById('queueItems');
  const queueProgressPct = document.getElementById('queueProgressPct');

  const searchInput = document.getElementById('searchInput');
  const filterChips = document.getElementById('filterChips');
  const btnViewGrid = document.getElementById('btnViewGrid');
  const btnViewTable = document.getElementById('btnViewTable');

  const fileGrid = document.getElementById('fileGrid');
  const fileTableWrap = document.getElementById('fileTableWrap');
  const fileTableBody = document.getElementById('fileTableBody');

  const paginationInfo = document.getElementById('paginationInfo');
  const pageIndicator = document.getElementById('pageIndicator');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');

  const previewModal = document.getElementById('previewModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalFileName = document.getElementById('modalFileName');
  const modalPreviewZone = document.getElementById('modalPreviewZone');
  const metaObjectId = document.getElementById('metaObjectId');
  const metaMimeType = document.getElementById('metaMimeType');
  const metaFileSize = document.getElementById('metaFileSize');
  const metaChunks = document.getElementById('metaChunks');
  const metaUploadedBy = document.getElementById('metaUploadedBy');
  const metaUploadDate = document.getElementById('metaUploadDate');
  const modalDownloadBtn = document.getElementById('modalDownloadBtn');
  const modalCopyLinkBtn = document.getElementById('modalCopyLinkBtn');
  const modalDeleteBtn = document.getElementById('modalDeleteBtn');

  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const btnCancelDelete = document.getElementById('btnCancelDelete');
  const btnConfirmDelete = document.getElementById('btnConfirmDelete');
  const toastContainer = document.getElementById('toastContainer');

  function getApiBase() {
    return state.customApiBase ? state.customApiBase.replace(/\/$/, '') : '';
  }

  // Format Helpers
  function formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function formatDate(dateString) {
    if (!dateString) return '-';
    const d = new Date(dateString);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

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

  function getCategoryIcon(category) {
    switch (category) {
      case 'image': return 'fa-solid fa-image';
      case 'pdf': return 'fa-solid fa-file-pdf';
      case 'document': return 'fa-solid fa-file-word';
      case 'spreadsheet': return 'fa-solid fa-file-excel';
      case 'presentation': return 'fa-solid fa-file-powerpoint';
      case 'archive': return 'fa-solid fa-file-zipper';
      case 'video': return 'fa-solid fa-file-video';
      case 'audio': return 'fa-solid fa-file-audio';
      case 'text': return 'fa-solid fa-file-lines';
      default: return 'fa-solid fa-file';
    }
  }

  // Show Toast Notification
  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-circle-xmark' : 'fa-info-circle';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Check Health
  async function checkHealth() {
    if (isGitHubPages && !state.customApiBase) {
      healthDot.classList.remove('disconnected');
      healthText.innerText = 'GitHub Pages Live Demo (GridFS Client Engine)';
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/health`);
      const data = await res.json();
      if (data.database && data.database.status === 'connected') {
        healthDot.classList.remove('disconnected');
        healthText.innerText = `GridFS Bucket: "${data.database.bucket}" (Connected)`;
      } else {
        healthDot.classList.add('disconnected');
        healthText.innerText = 'MongoDB: Disconnected';
      }
    } catch (err) {
      healthDot.classList.remove('disconnected');
      healthText.innerText = 'GitHub Pages Demo Mode';
    }
  }

  // Load Stats
  async function loadStats() {
    if (isGitHubPages && !state.customApiBase) {
      const totalFiles = localDbFiles.length;
      let totalBytes = 0;
      let totalChunks = 0;
      localDbFiles.forEach(f => {
        totalBytes += f.size || 0;
        totalChunks += Math.ceil((f.size || 1) / (255 * 1024));
      });
      statTotalFiles.innerText = totalFiles.toLocaleString();
      statTotalStorage.innerText = formatBytes(totalBytes);
      statTotalChunks.innerText = totalChunks.toLocaleString();
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/files/stats/summary`);
      const data = await res.json();
      if (data.success && data.stats) {
        statTotalFiles.innerText = data.stats.totalFiles.toLocaleString();
        statTotalStorage.innerText = data.stats.totalStorageFormatted;
        statTotalChunks.innerText = data.stats.totalChunks.toLocaleString();
      }
    } catch (err) {
      console.error('Failed to load stats', err);
    }
  }

  // Fetch Files
  async function fetchFiles() {
    if (isGitHubPages && !state.customApiBase) {
      let filtered = [...localDbFiles];
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        filtered = filtered.filter(f => f.originalName.toLowerCase().includes(q) || (f.metadata?.description || '').toLowerCase().includes(q));
      }
      if (state.currentCategory && state.currentCategory !== 'all') {
        filtered = filtered.filter(f => f.metadata?.category === state.currentCategory);
      }
      filtered.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));

      const page = state.pagination.currentPage;
      const limit = state.pagination.limit;
      const totalFiles = filtered.length;
      const totalPages = Math.ceil(totalFiles / limit) || 1;
      const paginated = filtered.slice((page - 1) * limit, page * limit);

      state.files = paginated;
      state.pagination = { currentPage: page, totalPages, totalFiles, limit, hasNextPage: page < totalPages, hasPrevPage: page > 1 };
      renderFiles();
      renderPagination();
      return;
    }

    try {
      const params = new URLSearchParams({
        page: state.pagination.currentPage,
        limit: state.pagination.limit,
        category: state.currentCategory,
        search: state.searchQuery,
        sortBy: 'uploadDate',
        order: 'desc'
      });

      const res = await fetch(`${getApiBase()}/api/files?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        state.files = data.files || [];
        state.pagination = data.pagination || state.pagination;
        renderFiles();
        renderPagination();
      } else {
        showToast(data.message || 'Failed to load files', 'error');
      }
    } catch (err) {
      showToast('Network error while loading files', 'error');
    }
  }

  // Render Files
  function renderFiles() {
    if (state.files.length === 0) {
      const emptyHtml = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <div class="empty-icon"><i class="fa-solid fa-box-open"></i></div>
          <h3>No files found</h3>
          <p>Upload files above or try a different search filter.</p>
        </div>
      `;
      fileGrid.innerHTML = emptyHtml;
      fileTableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 3rem;">No files found in database.</td></tr>`;
      return;
    }

    // Render Grid
    fileGrid.innerHTML = state.files.map(file => {
      const isImg = file.contentType.startsWith('image/');
      const previewHtml = isImg
        ? `<img src="${file.urls.view}" alt="${file.originalName}" loading="lazy">`
        : `<i class="${getCategoryIcon(file.metadata.category)} file-preview-icon"></i>`;

      return `
        <div class="file-card" data-id="${file.id}">
          <div class="file-preview" onclick="openPreview('${file.id}')">
            ${previewHtml}
            <span class="file-badge">${file.metadata.category || 'file'}</span>
          </div>
          <div class="file-name" title="${file.originalName}">${file.originalName}</div>
          <div class="file-details">
            <span>${formatBytes(file.size)}</span>
            <span>${formatDate(file.uploadDate)}</span>
          </div>
          <div class="file-actions">
            <button class="btn btn-secondary btn-sm" onclick="openPreview('${file.id}')" title="Inspect Metadata">
              <i class="fa-solid fa-eye"></i> View
            </button>
            <a href="${file.urls.download}" class="btn btn-secondary btn-sm btn-icon" title="Download" download="${file.originalName}">
              <i class="fa-solid fa-download"></i>
            </a>
            <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('${file.id}', '${file.originalName}')" title="Delete">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Render Table
    fileTableBody.innerHTML = state.files.map(file => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="${getCategoryIcon(file.metadata.category)}" style="color: var(--primary); font-size: 1.1rem;"></i>
            <div style="font-weight: 600; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${file.originalName}">
              ${file.originalName}
            </div>
          </div>
        </td>
        <td><span class="file-badge" style="position: static;">${file.metadata.category}</span></td>
        <td>${formatBytes(file.size)}</td>
        <td>${file.metadata.uploadedBy || 'anonymous'}</td>
        <td>${formatDate(file.uploadDate)}</td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm btn-icon" onclick="openPreview('${file.id}')" title="View details">
            <i class="fa-solid fa-eye"></i>
          </button>
          <a href="${file.urls.download}" class="btn btn-secondary btn-sm btn-icon" title="Download" download="${file.originalName}">
            <i class="fa-solid fa-download"></i>
          </a>
          <button class="btn btn-danger btn-sm btn-icon" onclick="confirmDelete('${file.id}', '${file.originalName}')" title="Delete">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  // Render Pagination
  function renderPagination() {
    const { currentPage, totalPages, totalFiles, limit } = state.pagination;
    const start = totalFiles === 0 ? 0 : (currentPage - 1) * limit + 1;
    const end = Math.min(currentPage * limit, totalFiles);

    paginationInfo.innerText = `Showing ${start}-${end} of ${totalFiles} files`;
    pageIndicator.innerText = `Page ${currentPage} of ${totalPages || 1}`;

    btnPrevPage.disabled = currentPage <= 1;
    btnNextPage.disabled = currentPage >= totalPages;
  }

  // GitHub Pages Standalone File Upload Simulator
  function uploadStandaloneFile(file, uploader, desc) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const id = '67' + Array.from({ length: 22 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
        const category = getFileCategory(file.type);
        const fileObj = {
          id,
          filename: `${Date.now()}-${file.name}`,
          originalName: file.name,
          contentType: file.type || 'application/octet-stream',
          size: file.size,
          uploadDate: new Date().toISOString(),
          metadata: {
            originalName: file.name,
            contentType: file.type,
            size: file.size,
            category,
            uploadedBy: uploader || 'anonymous',
            description: desc || ''
          },
          urls: {
            view: dataUrl,
            download: dataUrl,
            info: `#${id}`
          }
        };

        localDbFiles.unshift(fileObj);
        try {
          // Limit local storage items to prevent quota overflow
          localStorage.setItem('gh_pages_gridfs_files', JSON.stringify(localDbFiles.slice(0, 15)));
        } catch (err) {
          console.warn('Storage quota exceeded');
        }
        resolve(fileObj);
      };
      reader.readAsDataURL(file);
    });
  }

  // Upload Handlers with Progress
  async function uploadFilesXHR(endpoint, formData, filesCount, rawFiles = []) {
    uploadQueue.classList.add('active');
    queueItems.innerHTML = `
      <div class="queue-item">
        <div class="queue-file-info">
          <i class="fa-solid fa-spinner fa-spin" style="color: var(--primary);"></i>
          <span class="queue-file-name">Uploading ${filesCount} file(s) into GridFS...</span>
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar-fill" id="queueFill"></div>
        </div>
      </div>
    `;

    if (isGitHubPages && !state.customApiBase) {
      let pct = 0;
      const interval = setInterval(async () => {
        pct += 25;
        if (pct >= 100) {
          clearInterval(interval);
          document.getElementById('queueFill').style.width = '100%';
          queueProgressPct.innerText = '100%';

          const uploader = uploaderNameInput.value.trim();
          const desc = fileDescInput.value.trim();
          for (const f of rawFiles) {
            await uploadStandaloneFile(f, uploader, desc);
          }

          setTimeout(() => {
            uploadQueue.classList.remove('active');
            showToast(`${filesCount} file(s) uploaded successfully!`, 'success');
            fetchFiles();
            loadStats();
          }, 400);
        } else {
          document.getElementById('queueFill').style.width = `${pct}%`;
          queueProgressPct.innerText = `${pct}%`;
        }
      }, 100);
      return;
    }

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${getApiBase()}${endpoint}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        document.getElementById('queueFill').style.width = `${pct}%`;
        queueProgressPct.innerText = `${pct}%`;
      }
    };

    xhr.onload = () => {
      uploadQueue.classList.remove('active');
      try {
        const res = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          showToast(res.message || 'Upload complete!', 'success');
          fetchFiles();
          loadStats();
        } else {
          showToast(res.message || 'Upload failed', 'error');
        }
      } catch (e) {
        showToast('Unexpected server response', 'error');
      }
    };

    xhr.onerror = () => {
      uploadQueue.classList.remove('active');
      showToast('Network error during upload', 'error');
    };

    xhr.send(formData);
  }

  function handleSingleUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    if (uploaderNameInput.value.trim()) formData.append('uploadedBy', uploaderNameInput.value.trim());
    if (fileDescInput.value.trim()) formData.append('description', fileDescInput.value.trim());

    uploadFilesXHR('/api/files/upload', formData, 1, [file]);
  }

  function handleMultipleUpload(fileList) {
    if (!fileList || fileList.length === 0) return;
    const formData = new FormData();
    const rawFiles = [];
    for (let i = 0; i < fileList.length; i++) {
      formData.append('files[]', fileList[i]);
      rawFiles.push(fileList[i]);
    }
    if (uploaderNameInput.value.trim()) formData.append('uploadedBy', uploaderNameInput.value.trim());
    if (fileDescInput.value.trim()) formData.append('description', fileDescInput.value.trim());

    uploadFilesXHR('/api/files/upload-multiple', formData, fileList.length, rawFiles);
  }

  // Event Listeners: Browse Buttons
  btnBrowseSingle.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputSingle.click();
  });

  btnBrowseMultiple.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInputMultiple.click();
  });

  fileInputSingle.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleSingleUpload(e.target.files[0]);
      e.target.value = '';
    }
  });

  fileInputMultiple.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleMultipleUpload(e.target.files);
      e.target.value = '';
    }
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length === 1) {
      handleSingleUpload(files[0]);
    } else if (files.length > 1) {
      handleMultipleUpload(files);
    }
  });

  dropZone.addEventListener('click', () => {
    fileInputSingle.click();
  });

  // Search Debounce
  let searchTimeout;
  searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      state.searchQuery = e.target.value.trim();
      state.pagination.currentPage = 1;
      fetchFiles();
    }, 300);
  });

  // Category Filters
  filterChips.addEventListener('click', (e) => {
    if (e.target.classList.contains('chip')) {
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
      state.currentCategory = e.target.dataset.category;
      state.pagination.currentPage = 1;
      fetchFiles();
    }
  });

  // View Switcher
  btnViewGrid.addEventListener('click', () => {
    btnViewGrid.classList.add('active');
    btnViewTable.classList.remove('active');
    fileGrid.style.display = 'grid';
    fileTableWrap.classList.remove('active');
  });

  btnViewTable.addEventListener('click', () => {
    btnViewTable.classList.add('active');
    btnViewGrid.classList.remove('active');
    fileGrid.style.display = 'none';
    fileTableWrap.classList.add('active');
  });

  // Pagination
  btnPrevPage.addEventListener('click', () => {
    if (state.pagination.currentPage > 1) {
      state.pagination.currentPage--;
      fetchFiles();
    }
  });

  btnNextPage.addEventListener('click', () => {
    if (state.pagination.currentPage < state.pagination.totalPages) {
      state.pagination.currentPage++;
      fetchFiles();
    }
  });

  // Preview Modal
  window.openPreview = async (id) => {
    const localFile = localDbFiles.find(f => f.id === id);
    if (isGitHubPages && localFile && !state.customApiBase) {
      state.activeModalFile = localFile;
      modalFileName.innerText = localFile.originalName;
      metaObjectId.innerText = localFile.id;
      metaMimeType.innerText = localFile.contentType;
      metaFileSize.innerText = `${formatBytes(localFile.size)} (${localFile.size.toLocaleString()} bytes)`;
      metaChunks.innerText = `${Math.ceil((localFile.size || 1) / (255 * 1024))} chunk(s) (255KB each)`;
      metaUploadedBy.innerText = localFile.metadata.uploadedBy || 'anonymous';
      metaUploadDate.innerText = formatDate(localFile.uploadDate);

      modalDownloadBtn.href = localFile.urls.download;
      modalDownloadBtn.setAttribute('download', localFile.originalName);

      const contentType = localFile.contentType;
      modalPreviewZone.innerHTML = '';
      if (contentType.startsWith('image/')) {
        modalPreviewZone.innerHTML = `<img src="${localFile.urls.view}" alt="${localFile.originalName}">`;
      } else if (contentType === 'application/pdf') {
        modalPreviewZone.innerHTML = `<iframe src="${localFile.urls.view}" title="PDF Viewer"></iframe>`;
      } else if (contentType.startsWith('video/')) {
        modalPreviewZone.innerHTML = `<video controls autoplay muted src="${localFile.urls.view}"></video>`;
      } else if (contentType.startsWith('audio/')) {
        modalPreviewZone.innerHTML = `<audio controls src="${localFile.urls.view}" style="width: 80%;"></audio>`;
      } else {
        modalPreviewZone.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <i class="${getCategoryIcon(localFile.metadata.category)}" style="font-size: 3.5rem; margin-bottom: 1rem; color: var(--primary);"></i>
            <p>Binary file stream stored across ${Math.ceil((localFile.size || 1) / (255 * 1024))} GridFS chunk(s)</p>
          </div>
        `;
      }

      previewModal.classList.add('active');
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/files/${id}/info`);
      const data = await res.json();
      if (!data.success) {
        showToast(data.message || 'File not found', 'error');
        return;
      }

      const file = data.file;
      const gridfs = data.gridfs || {};
      state.activeModalFile = file;

      modalFileName.innerText = file.originalName;
      metaObjectId.innerText = file.id;
      metaMimeType.innerText = file.contentType;
      metaFileSize.innerText = `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`;
      metaChunks.innerText = `${gridfs.totalChunks || 1} chunk(s) (255KB each)`;
      metaUploadedBy.innerText = file.metadata.uploadedBy || 'anonymous';
      metaUploadDate.innerText = formatDate(file.uploadDate);

      modalDownloadBtn.href = file.urls.download;
      modalDownloadBtn.setAttribute('download', file.originalName);

      // Render Preview Content
      const contentType = file.contentType;
      modalPreviewZone.innerHTML = '';

      if (contentType.startsWith('image/')) {
        modalPreviewZone.innerHTML = `<img src="${file.urls.view}" alt="${file.originalName}">`;
      } else if (contentType === 'application/pdf') {
        modalPreviewZone.innerHTML = `<iframe src="${file.urls.view}" title="PDF Viewer"></iframe>`;
      } else if (contentType.startsWith('video/')) {
        modalPreviewZone.innerHTML = `<video controls autoplay muted src="${file.urls.view}"></video>`;
      } else if (contentType.startsWith('audio/')) {
        modalPreviewZone.innerHTML = `<audio controls src="${file.urls.view}" style="width: 80%;"></audio>`;
      } else {
        modalPreviewZone.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
            <i class="${getCategoryIcon(file.metadata.category)}" style="font-size: 3.5rem; margin-bottom: 1rem; color: var(--primary);"></i>
            <p>Binary file stream stored across ${gridfs.totalChunks || 1} GridFS chunk(s)</p>
          </div>
        `;
      }

      previewModal.classList.add('active');
    } catch (err) {
      showToast('Failed to load file details', 'error');
    }
  };

  modalCloseBtn.addEventListener('click', () => {
    previewModal.classList.remove('active');
    modalPreviewZone.innerHTML = '';
  });

  previewModal.addEventListener('click', (e) => {
    if (e.target === previewModal) {
      previewModal.classList.remove('active');
      modalPreviewZone.innerHTML = '';
    }
  });

  modalCopyLinkBtn.addEventListener('click', () => {
    if (state.activeModalFile) {
      navigator.clipboard.writeText(state.activeModalFile.urls.view)
        .then(() => showToast('Direct stream link copied to clipboard!', 'success'))
        .catch(() => showToast('Failed to copy link', 'error'));
    }
  });

  modalDeleteBtn.addEventListener('click', () => {
    if (state.activeModalFile) {
      previewModal.classList.remove('active');
      confirmDelete(state.activeModalFile.id, state.activeModalFile.originalName);
    }
  });

  // Delete Action
  window.confirmDelete = (id, name) => {
    state.fileToDeleteId = id;
    document.getElementById('deleteConfirmText').innerText = `Are you sure you want to delete "${name}"? This will permanently remove its metadata and GridFS chunks.`;
    deleteConfirmModal.classList.add('active');
  };

  btnCancelDelete.addEventListener('click', () => {
    deleteConfirmModal.classList.remove('active');
    state.fileToDeleteId = null;
  });

  deleteConfirmModal.addEventListener('click', (e) => {
    if (e.target === deleteConfirmModal) {
      deleteConfirmModal.classList.remove('active');
      state.fileToDeleteId = null;
    }
  });

  btnConfirmDelete.addEventListener('click', async () => {
    if (!state.fileToDeleteId) return;

    if (isGitHubPages && !state.customApiBase) {
      const idx = localDbFiles.findIndex(f => f.id === state.fileToDeleteId);
      if (idx !== -1) localDbFiles.splice(idx, 1);
      localStorage.setItem('gh_pages_gridfs_files', JSON.stringify(localDbFiles));
      deleteConfirmModal.classList.remove('active');
      showToast('File deleted successfully', 'success');
      fetchFiles();
      loadStats();
      return;
    }

    try {
      const res = await fetch(`${getApiBase()}/api/files/${state.fileToDeleteId}`, { method: 'DELETE' });
      const data = await res.json();
      deleteConfirmModal.classList.remove('active');

      if (data.success) {
        showToast('File deleted successfully', 'success');
        fetchFiles();
        loadStats();
      } else {
        showToast(data.message || 'Failed to delete file', 'error');
      }
    } catch (err) {
      showToast('Error deleting file', 'error');
    }
  });

  // Initialize
  checkHealth();
  loadStats();
  fetchFiles();
  setInterval(checkHealth, 15000);
});
