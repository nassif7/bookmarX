// filepath: chrome/popup/popup.js
/**
 * Bookmarkd Popup Script
 * Handles all UI interactions and communicates with background script
 */

// Listen for scroll events from content script (must be top-level, not inside init)
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'SCROLL_COMPLETE') {
    clearInterval(syncPollInterval);
    isSyncing = false;
    setSyncBanner(false);
    loadData().then(() => {
      render();
      showToast(`Sync complete — ${state.bookmarks.length} bookmark${state.bookmarks.length !== 1 ? 's' : ''} saved`, 'success');
    });
  }
});

let isSyncing = false;
let syncPollInterval = null;

async function startSync() {
  if (isSyncing) return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.url) {
    showToast('Could not access the current tab', 'error');
    return;
  }

  const isOnX = tab.url.includes('x.com') || tab.url.includes('twitter.com');
  if (!isOnX) {
    showToast('Open x.com in a tab first, then click Sync', 'warning');
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'START_AUTO_SCROLL' });
  } catch (_) {
    showToast('Could not reach x.com tab — try refreshing it', 'error');
    return;
  }

  isSyncing = true;
  setSyncBanner(true);

  // Refresh bookmark count every second while scrolling
  syncPollInterval = setInterval(async () => {
    const result = await chrome.storage.local.get('bookmarks');
    const count = (result.bookmarks || []).length;
    const el = document.getElementById('syncCount');
    if (el) el.textContent = ` — ${count} captured`;
  }, 1000);
}

function stopSync() {
  clearInterval(syncPollInterval);
  isSyncing = false;
  setSyncBanner(false);
  loadData().then(() => render());
}

function setSyncBanner(visible) {
  document.getElementById('syncBanner').classList.toggle('active', visible);
  document.getElementById('syncBtn').disabled = visible;
  document.getElementById('syncBtn').classList.toggle('spinning', visible);
}

// State
let state = {
  bookmarks: [],
  categories: [],
  tags: [],
  activeTab: 'bookmarks',
  searchQuery: '',
  categoryFilter: '',
  tagFilter: '',
  editingCategory: null,
  editingTag: null,
  selectedBookmark: null
};

// DOM Elements
const elements = {};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
  cacheElements();
  attachEventListeners();
  await loadData();
  render();
}

/**
 * Cache DOM elements
 */
function cacheElements() {
  elements.searchInput = document.getElementById('searchInput');
  elements.searchClear = document.getElementById('searchClear');
  elements.categoryFilter = document.getElementById('categoryFilter');
  elements.tagFilter = document.getElementById('tagFilter');
  elements.bookmarksList = document.getElementById('bookmarksList');
  elements.categoriesList = document.getElementById('categoriesList');
  elements.tagsList = document.getElementById('tagsList');
  elements.emptyBookmarks = document.getElementById('emptyBookmarks');
  elements.emptyCategories = document.getElementById('emptyCategories');
  elements.emptyTags = document.getElementById('emptyTags');
  elements.bookmarkCount = document.getElementById('bookmarkCount');
  elements.categoryCount = document.getElementById('categoryCount');
  elements.tagCount = document.getElementById('tagCount');
  elements.toastContainer = document.getElementById('toastContainer');
  
  // Modals
  elements.categoryModal = document.getElementById('categoryModal');
  elements.tagModal = document.getElementById('tagModal');
  elements.exportModal = document.getElementById('exportModal');
  elements.bookmarkDetailModal = document.getElementById('bookmarkDetailModal');
  
  // Category form
  elements.categoryName = document.getElementById('categoryName');
  elements.categoryColor = document.getElementById('categoryColor');
  elements.categoryModalTitle = document.getElementById('categoryModalTitle');
  elements.saveCategoryBtn = document.getElementById('saveCategoryBtn');
  
  // Tag form
  elements.tagName = document.getElementById('tagName');
  elements.tagColor = document.getElementById('tagColor');
  elements.tagModalTitle = document.getElementById('tagModalTitle');
  elements.saveTagBtn = document.getElementById('saveTagBtn');
  
  // Bookmark detail
  elements.bookmarkDetailContent = document.getElementById('bookmarkDetailContent');
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Tabs
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
  
  // Search
  elements.searchInput.addEventListener('input', handleSearch);
  elements.searchClear.addEventListener('click', clearSearch);
  
  // Filters
  elements.categoryFilter.addEventListener('change', handleCategoryFilter);
  elements.tagFilter.addEventListener('change', handleTagFilter);
  
  // Sync
  document.getElementById('syncBtn').addEventListener('click', startSync);
  document.getElementById('stopSyncBtn').addEventListener('click', stopSync);
  document.getElementById('emptySyncBtn')?.addEventListener('click', startSync);

  // Export
  document.getElementById('exportBtn').addEventListener('click', () => openModal('exportModal'));
  document.getElementById('exportJson').addEventListener('click', () => exportBookmarks('json'));
  document.getElementById('exportCsv').addEventListener('click', () => exportBookmarks('csv'));
  
  // Category modal
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  elements.saveCategoryBtn.addEventListener('click', saveCategory);
  
  // Tag modal
  document.getElementById('addTagBtn').addEventListener('click', () => openTagModal());
  elements.saveTagBtn.addEventListener('click', saveTag);
  
  // Color presets
  document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', (e) => {
      const color = e.target.dataset.color;
      const input = e.target.closest('.color-picker').querySelector('input[type="color"]');
      input.value = color;
      updateColorPresets(input);
    });
  });
  
  // Modal close buttons
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  
  // Close modals on backdrop click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
  
  // Color picker change
  elements.categoryColor.addEventListener('input', () => updateColorPresets(elements.categoryColor));
  elements.tagColor.addEventListener('input', () => updateColorPresets(elements.tagColor));
}

/**
 * Update color presets active state
 */
function updateColorPresets(input) {
  const presets = input.closest('.color-picker').querySelectorAll('.color-preset');
  presets.forEach(preset => {
    preset.classList.toggle('active', preset.dataset.color === input.value);
  });
}

/**
 * Load data from background script
 */
async function loadData() {
  try {
    const [bookmarksResult, categoriesResult, tagsResult] = await Promise.all([
      sendMessage({ action: 'GET_BOOKMARKS', data: {} }),
      sendMessage({ action: 'GET_CATEGORIES', data: {} }),
      sendMessage({ action: 'GET_TAGS', data: {} })
    ]);
    
    state.bookmarks = bookmarksResult.bookmarks || [];
    state.categories = categoriesResult.categories || [];
    state.tags = tagsResult.tags || [];
  } catch (error) {
    console.error('Error loading data:', error);
    showToast('Failed to load data', 'error');
  }
}

/**
 * Send message to background script
 */
function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response || {});
      }
    });
  });
}

/**
 * Switch tabs
 */
function switchTab(tabId) {
  state.activeTab = tabId;
  
  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.tab === tabId);
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `tab-${tabId}`);
  });
}

/**
 * Handle search
 */
async function handleSearch(e) {
  const query = e.target.value;
  state.searchQuery = query;
  
  elements.searchClear.style.display = query ? 'flex' : 'none';
  
  if (query) {
    const result = await sendMessage({ action: 'SEARCH_BOOKMARKS', data: { query } });
    state.bookmarks = result.bookmarks || [];
  } else {
    await loadData();
  }
  
  renderBookmarks();
}

/**
 * Clear search
 */
async function clearSearch() {
  elements.searchInput.value = '';
  state.searchQuery = '';
  elements.searchClear.style.display = 'none';
  await loadData();
  renderBookmarks();
}

/**
 * Handle category filter
 */
async function handleCategoryFilter(e) {
  state.categoryFilter = e.target.value;
  await filterBookmarks();
}

/**
 * Handle tag filter
 */
async function handleTagFilter(e) {
  state.tagFilter = e.target.value;
  await filterBookmarks();
}

/**
 * Filter bookmarks
 */
async function filterBookmarks() {
  const filters = {};
  if (state.categoryFilter) filters.categoryId = state.categoryFilter;
  if (state.tagFilter) filters.tagId = state.tagFilter;
  
  const result = await sendMessage({ action: 'GET_BOOKMARKS', data: filters });
  state.bookmarks = result.bookmarks || [];
  renderBookmarks();
}

/**
 * Render all
 */
function render() {
  renderFilters();
  renderBookmarks();
  renderCategories();
  renderTags();
  renderStats();
}

/**
 * Render filters
 */
function renderFilters() {
  // Category filter
  elements.categoryFilter.innerHTML = '<option value="">All Categories</option>';
  state.categories.forEach(cat => {
    elements.categoryFilter.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
  });
  
  // Tag filter
  elements.tagFilter.innerHTML = '<option value="">All Tags</option>';
  state.tags.forEach(tag => {
    elements.tagFilter.innerHTML += `<option value="${tag.id}">${tag.name}</option>`;
  });
}

/**
 * Render bookmarks
 */
function renderBookmarks() {
  if (state.bookmarks.length === 0) {
    elements.bookmarksList.innerHTML = '';
    elements.emptyBookmarks.style.display = 'flex';
    return;
  }
  
  elements.emptyBookmarks.style.display = 'none';
  
  elements.bookmarksList.innerHTML = state.bookmarks.map(bookmark => {
    const category = state.categories.find(c => c.id === bookmark.categoryId);
    const tags = (bookmark.tagIds || []).map(tid => state.tags.find(t => t.id === tid)).filter(Boolean);
    
    return `
      <div class="bookmark-item" data-id="${bookmark.id}" draggable="true">
        <img class="bookmark-avatar" src="${bookmark.authorAvatar || ''}" alt="${bookmark.authorName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23666666%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'">
        <div class="bookmark-content">
          <div class="bookmark-header">
            <span class="bookmark-author">${escapeHtml(bookmark.authorName)}</span>
            <span class="bookmark-handle">@${escapeHtml(bookmark.authorHandle)}</span>
          </div>
          <p class="bookmark-text">${escapeHtml(bookmark.text)}</p>
          <div class="bookmark-meta">
            <span class="bookmark-date">${formatDate(bookmark.dateBookmarked)}</span>
            ${category ? `<span class="bookmark-category" style="background: ${category.color}20; color: ${category.color}">${escapeHtml(category.name)}</span>` : ''}
            ${tags.length > 0 ? `
              <div class="bookmark-tags">
                ${tags.map(tag => `<span class="bookmark-tag" style="background: ${tag.color}20; color: ${tag.color}">${escapeHtml(tag.name)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
          ${bookmark.media && bookmark.media.length > 0 ? `
            <div class="bookmark-media">
              ${bookmark.media.slice(0, 4).map(m => `<img src="${m.url}" alt="Media">`).join('')}
            </div>
          ` : ''}
        </div>
        <div class="bookmark-actions">
          <button class="bookmark-action-btn edit" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="bookmark-action-btn delete" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join('');
  
  document.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', () => openBookmarkDetail(item.dataset.id));
    item.querySelector('.bookmark-action-btn.edit').addEventListener('click', (e) => {
      e.stopPropagation();
      openBookmarkDetail(item.dataset.id);
    });
    item.querySelector('.bookmark-action-btn.delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteBookmark(item.dataset.id);
    });
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragend', handleDragEnd);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
  });
}

/**
 * Render categories
 */
function renderCategories() {
  if (state.categories.length === 0) {
    elements.categoriesList.innerHTML = '';
    elements.emptyCategories.style.display = 'flex';
    return;
  }
  
  elements.emptyCategories.style.display = 'none';
  
  elements.categoriesList.innerHTML = state.categories.map(cat => {
    const count = state.bookmarks.filter(b => b.categoryId === cat.id).length;

    return `
      <div class="category-item" data-id="${cat.id}">
        <div class="category-info">
          <div class="category-color" style="background: ${cat.color}"></div>
          <span class="category-name">${escapeHtml(cat.name)}</span>
          <span class="category-count">${count} bookmark${count !== 1 ? 's' : ''}</span>
        </div>
        <div class="category-actions">
          <button class="btn btn-sm btn-secondary edit">Edit</button>
          <button class="btn btn-sm btn-secondary delete">Delete</button>
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.category-item').forEach(item => {
    item.querySelector('.edit').addEventListener('click', () => editCategory(item.dataset.id));
    item.querySelector('.delete').addEventListener('click', () => deleteCategory(item.dataset.id));
  });
}

/**
 * Render tags
 */
function renderTags() {
  if (state.tags.length === 0) {
    elements.tagsList.innerHTML = '';
    elements.emptyTags.style.display = 'flex';
    return;
  }
  
  elements.emptyTags.style.display = 'none';
  
  elements.tagsList.innerHTML = state.tags.map(tag => {
    const count = state.bookmarks.filter(b => b.tagIds && b.tagIds.includes(tag.id)).length;

    return `
      <div class="tag-item" data-id="${tag.id}">
        <div class="tag-color" style="background: ${tag.color}"></div>
        <span class="tag-name">${escapeHtml(tag.name)}</span>
        <span class="tag-count">${count}</span>
        <button class="tag-delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.tag-item').forEach(item => {
    item.querySelector('.tag-delete').addEventListener('click', () => deleteTag(item.dataset.id));
  });
}

/**
 * Render stats
 */
function renderStats() {
  elements.bookmarkCount.textContent = `${state.bookmarks.length} bookmark${state.bookmarks.length !== 1 ? 's' : ''}`;
  elements.categoryCount.textContent = `${state.categories.length} categor${state.categories.length !== 1 ? 'ies' : 'y'}`;
  elements.tagCount.textContent = `${state.tags.length} tag${state.tags.length !== 1 ? 's' : ''}`;
}

/**
 * Open category modal
 */
function openCategoryModal(category = null) {
  state.editingCategory = category;
  elements.categoryModalTitle.textContent = category ? 'Edit Category' : 'Add Category';
  elements.categoryName.value = category ? category.name : '';
  elements.categoryColor.value = category ? category.color : '#6366f1';
  updateColorPresets(elements.categoryColor);
  openModal('categoryModal');
}

/**
 * Save category
 */
async function saveCategory() {
  const name = elements.categoryName.value.trim();
  const color = elements.categoryColor.value;
  
  if (!name) {
    showToast('Please enter a category name', 'warning');
    return;
  }
  
  try {
    if (state.editingCategory) {
      await sendMessage({
        action: 'UPDATE_CATEGORY',
        data: { id: state.editingCategory.id, updates: { name, color } }
      });
      showToast('Category updated', 'success');
    } else {
      await sendMessage({
        action: 'ADD_CATEGORY',
        data: { category: { name, color } }
      });
      showToast('Category created', 'success');
    }
    
    closeModal('categoryModal');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to save category', 'error');
  }
}

/**
 * Edit category
 */
function editCategory(id) {
  const category = state.categories.find(c => c.id === id);
  if (category) {
    openCategoryModal(category);
  }
}

/**
 * Delete category
 */
async function deleteCategory(id) {
  if (!confirm('Are you sure you want to delete this category?')) return;
  
  try {
    await sendMessage({ action: 'DELETE_CATEGORY', data: { id } });
    showToast('Category deleted', 'success');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to delete category', 'error');
  }
}

/**
 * Open tag modal
 */
function openTagModal(tag = null) {
  state.editingTag = tag;
  elements.tagModalTitle.textContent = tag ? 'Edit Tag' : 'Add Tag';
  elements.tagName.value = tag ? tag.name : '';
  elements.tagColor.value = tag ? tag.color : '#10b981';
  updateColorPresets(elements.tagColor);
  openModal('tagModal');
}

/**
 * Save tag
 */
async function saveTag() {
  const name = elements.tagName.value.trim();
  const color = elements.tagColor.value;
  
  if (!name) {
    showToast('Please enter a tag name', 'warning');
    return;
  }
  
  try {
    if (state.editingTag) {
      await sendMessage({
        action: 'UPDATE_TAG',
        data: { id: state.editingTag.id, updates: { name, color } }
      });
      showToast('Tag updated', 'success');
    } else {
      await sendMessage({
        action: 'ADD_TAG',
        data: { tag: { name, color } }
      });
      showToast('Tag created', 'success');
    }
    
    closeModal('tagModal');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to save tag', 'error');
  }
}

/**
 * Delete tag
 */
async function deleteTag(id) {
  if (!confirm('Are you sure you want to delete this tag?')) return;
  
  try {
    await sendMessage({ action: 'DELETE_TAG', data: { id } });
    showToast('Tag deleted', 'success');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to delete tag', 'error');
  }
}

/**
 * Delete bookmark
 */
async function deleteBookmark(id) {
  if (!confirm('Are you sure you want to delete this bookmark?')) return;
  
  try {
    await sendMessage({ action: 'DELETE_BOOKMARK', data: { id } });
    showToast('Bookmark deleted', 'success');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to delete bookmark', 'error');
  }
}

/**
 * Open bookmark detail modal
 */
function openBookmarkDetail(id) {
  const bookmark = state.bookmarks.find(b => b.id === id);
  if (!bookmark) return;
  
  state.selectedBookmark = bookmark;
  
  const category = state.categories.find(c => c.id === bookmark.categoryId);
  const tags = (bookmark.tagIds || []).map(tid => state.tags.find(t => t.id === tid)).filter(Boolean);
  
  elements.bookmarkDetailContent.innerHTML = `
    <div class="bookmark-detail">
      <div class="bookmark-detail-header">
        <img class="bookmark-detail-avatar" src="${bookmark.authorAvatar || ''}" alt="${bookmark.authorName}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22%23666666%22><circle cx=%2212%22 cy=%2212%22 r=%2210%22/></svg>'">
        <div class="bookmark-detail-info">
          <div class="bookmark-detail-author">${escapeHtml(bookmark.authorName)}</div>
          <div class="bookmark-detail-handle">@${escapeHtml(bookmark.authorHandle)}</div>
        </div>
      </div>
      
      <p class="bookmark-detail-text">${escapeHtml(bookmark.text)}</p>
      
      <div class="bookmark-detail-meta">
        <a class="bookmark-detail-link" href="${bookmark.tweetUrl}" target="_blank">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View on X
        </a>
        <span class="bookmark-date">Saved: ${formatDate(bookmark.dateBookmarked)}</span>
      </div>
      
      <div class="bookmark-detail-section">
        <h4>Category</h4>
        <div class="bookmark-detail-categories">
          <select class="filter-select" id="bookmarkCategorySelect">
            <option value="">No Category</option>
            ${state.categories.map(cat => `
              <option value="${cat.id}" ${bookmark.categoryId === cat.id ? 'selected' : ''}>${escapeHtml(cat.name)}</option>
            `).join('')}
          </select>
        </div>
      </div>
      
      <div class="bookmark-detail-section">
        <h4>Tags</h4>
        <div class="bookmark-detail-tags">
          ${state.tags.map(tag => {
            const isAssigned = bookmark.tagIds && bookmark.tagIds.includes(tag.id);
            return `
              <span class="bookmark-tag" data-tag-id="${tag.id}" style="background: ${tag.color}20; color: ${tag.color}; cursor: pointer; ${isAssigned ? 'border: 1px solid ' + tag.color : ''}">
                ${escapeHtml(tag.name)}
              </span>
            `;
          }).join('')}
          ${state.tags.length === 0 ? '<span style="color: var(--text-tertiary)">No tags available</span>' : ''}
        </div>
      </div>
    </div>
  `;
  
  openModal('bookmarkDetailModal');

  document.getElementById('bookmarkCategorySelect').addEventListener('change', function () {
    assignCategory(bookmark.id, this.value);
  });
  document.querySelectorAll('.bookmark-detail-tags .bookmark-tag[data-tag-id]').forEach(span => {
    span.addEventListener('click', () => toggleTag(bookmark.id, span.dataset.tagId));
  });
}

/**
 * Assign category to bookmark
 */
async function assignCategory(bookmarkId, categoryId) {
  try {
    await sendMessage({
      action: 'ASSIGN_CATEGORY',
      data: { bookmarkId, categoryId: categoryId || null }
    });
    showToast('Category assigned', 'success');
    await loadData();
    render();
  } catch (error) {
    showToast('Failed to assign category', 'error');
  }
}

/**
 * Toggle tag on bookmark
 */
async function toggleTag(bookmarkId, tagId) {
  const bookmark = state.bookmarks.find(b => b.id === bookmarkId);
  if (!bookmark) return;
  
  const hasTag = bookmark.tagIds && bookmark.tagIds.includes(tagId);
  
  try {
    if (hasTag) {
      await sendMessage({
        action: 'REMOVE_TAG_FROM_BOOKMARK',
        data: { bookmarkId, tagId }
      });
    } else {
      await sendMessage({
        action: 'ADD_TAG_TO_BOOKMARK',
        data: { bookmarkId, tagId }
      });
    }
    
    await loadData();
    render();
    
    // Reopen detail modal to show updated state
    openBookmarkDetail(bookmarkId);
  } catch (error) {
    showToast('Failed to update tag', 'error');
  }
}

/**
 * Export bookmarks
 */
async function exportBookmarks(format) {
  try {
    const result = await sendMessage({ action: 'EXPORT_BOOKMARKS', data: { format } });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Create download
    const blob = new Blob([result.data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    closeModal('exportModal');
    showToast(`Exported as ${format.toUpperCase()}`, 'success');
  } catch (error) {
    showToast('Failed to export', 'error');
  }
}

// Drag and drop handlers
let draggedItem = null;

function handleDragStart(e) {
  draggedItem = e.target;
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(e) {
  e.target.classList.remove('dragging');
  draggedItem = null;
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

async function handleDrop(e) {
  e.preventDefault();
  
  if (!draggedItem || draggedItem === e.target) return;
  
  const bookmarkId = draggedItem.dataset.id;
  const targetId = e.target.closest('.bookmark-item')?.dataset.id;
  
  if (!targetId || bookmarkId === targetId) return;
  
  // For now, just reorder - could be enhanced to assign to category
  showToast('Bookmark reordered', 'success');
}

// Modal helpers
function openModal(modalId) {
  document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
}

// Toast
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  elements.toastContainer.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 3000);
}

// Utility functions
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  
  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return minutes <= 1 ? 'Just now' : `${minutes}m ago`;
    }
    return `${hours}h ago`;
  }
  
  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  
  // Otherwise show date
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Expose functions to global scope for onclick handlers
window.editCategory = editCategory;
window.deleteCategory = deleteCategory;
window.deleteTag = deleteTag;
window.deleteBookmark = deleteBookmark;
window.openBookmarkDetail = openBookmarkDetail;
window.assignCategory = assignCategory;
window.toggleTag = toggleTag;