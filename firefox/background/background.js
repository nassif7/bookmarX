// filepath: chrome/background/background.js
/**
 * Background service worker for Bookmarkd
 * Handles storage, message passing, and extension lifecycle
 */

// Storage keys
const STORAGE_KEYS = {
  BOOKMARKS: 'bookmarks',
  CATEGORIES: 'categories',
  TAGS: 'tags',
  SETTINGS: 'settings'
};

/**
 * Initialize default storage if needed
 */
async function initializeStorage() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.BOOKMARKS,
    STORAGE_KEYS.CATEGORIES,
    STORAGE_KEYS.TAGS
  ]);

  if (!result[STORAGE_KEYS.BOOKMARKS]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: [] });
  }
  if (!result[STORAGE_KEYS.CATEGORIES]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: [] });
  }
  if (!result[STORAGE_KEYS.TAGS]) {
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: [] });
  }
}

// Initialize on install
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
  console.log('Bookmarkd: Extension installed');
});

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  initializeStorage();
  console.log('Bookmarkd: Extension started');
});

/**
 * Handle incoming messages from content script or popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message).then(sendResponse);
  return true; // Keep channel open for async response
});

/**
 * Message handler
 */
async function handleMessage(message) {
  const { action, data } = message;

  switch (action) {
    case 'BOOKMARKS_CAPTURED':
      return await saveBookmarks(data.bookmarks);
    
    case 'GET_BOOKMARKS':
      return await getBookmarks(data);
    
    case 'ADD_BOOKMARK':
      return await addBookmark(data.bookmark);
    
    case 'UPDATE_BOOKMARK':
      return await updateBookmark(data.id, data.updates);
    
    case 'DELETE_BOOKMARK':
      return await deleteBookmark(data.id);
    
    case 'GET_CATEGORIES':
      return await getCategories();
    
    case 'ADD_CATEGORY':
      return await addCategory(data.category);
    
    case 'UPDATE_CATEGORY':
      return await updateCategory(data.id, data.updates);
    
    case 'DELETE_CATEGORY':
      return await deleteCategory(data.id);
    
    case 'GET_TAGS':
      return await getTags();
    
    case 'ADD_TAG':
      return await addTag(data.tag);
    
    case 'UPDATE_TAG':
      return await updateTag(data.id, data.updates);
    
    case 'DELETE_TAG':
      return await deleteTag(data.id);
    
    case 'ASSIGN_CATEGORY':
      return await assignCategory(data.bookmarkId, data.categoryId);
    
    case 'ADD_TAG_TO_BOOKMARK':
      return await addTagToBookmark(data.bookmarkId, data.tagId);
    
    case 'REMOVE_TAG_FROM_BOOKMARK':
      return await removeTagFromBookmark(data.bookmarkId, data.tagId);
    
    case 'EXPORT_BOOKMARKS':
      return await exportBookmarks(data.format);
    
    case 'SEARCH_BOOKMARKS':
      return await searchBookmarks(data.query);
    
    case 'GET_STATS':
      return await getStats();
    
    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Save multiple bookmarks
 */
async function saveBookmarks(bookmarks) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const existingBookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    const newBookmarks = bookmarks.filter(b => 
      !existingBookmarks.some(eb => eb.id === b.id)
    );
    
    if (newBookmarks.length === 0) {
      return { success: true, added: 0 };
    }
    
    const updatedBookmarks = [...existingBookmarks, ...newBookmarks];
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updatedBookmarks });
    
    return { success: true, added: newBookmarks.length };
  } catch (error) {
    console.error('Bookmarkd: Error saving bookmarks', error);
    return { success: false, error: error.message };
  }
}

/**
 * Get all bookmarks with optional filters
 */
async function getBookmarks(filters = {}) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    let bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    if (filters.categoryId) {
      bookmarks = bookmarks.filter(b => b.categoryId === filters.categoryId);
    }
    
    if (filters.tagId) {
      bookmarks = bookmarks.filter(b => 
        b.tagIds && b.tagIds.includes(filters.tagId)
      );
    }
    
    // Sort by date bookmarked (newest first)
    bookmarks.sort((a, b) => 
      new Date(b.dateBookmarked) - new Date(a.dateBookmarked)
    );
    
    return { success: true, bookmarks };
  } catch (error) {
    return { success: false, error: error.message, bookmarks: [] };
  }
}

/**
 * Add a single bookmark
 */
async function addBookmark(bookmark) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    // Check if already exists
    if (bookmarks.some(b => b.id === bookmark.id)) {
      return { success: false, error: 'Bookmark already exists' };
    }
    
    bookmarks.push(bookmark);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    
    return { success: true, bookmark };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a bookmark
 */
async function updateBookmark(id, updates) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    const index = bookmarks.findIndex(b => b.id === id);
    if (index === -1) {
      return { success: false, error: 'Bookmark not found' };
    }
    
    bookmarks[index] = { ...bookmarks[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    
    return { success: true, bookmark: bookmarks[index] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a bookmark
 */
async function deleteBookmark(id) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    const filtered = bookmarks.filter(b => b.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: filtered });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all categories
 */
async function getCategories() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    return { success: true, categories: result[STORAGE_KEYS.CATEGORIES] || [] };
  } catch (error) {
    return { success: false, error: error.message, categories: [] };
  }
}

/**
 * Add a category
 */
async function addCategory(category) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories = result[STORAGE_KEYS.CATEGORIES] || [];
    
    const newCategory = {
      id: generateId(),
      name: category.name,
      color: category.color || '#6366f1',
      createdAt: new Date().toISOString()
    };
    
    categories.push(newCategory);
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
    
    return { success: true, category: newCategory };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a category
 */
async function updateCategory(id, updates) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories = result[STORAGE_KEYS.CATEGORIES] || [];
    
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) {
      return { success: false, error: 'Category not found' };
    }
    
    categories[index] = { ...categories[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
    
    return { success: true, category: categories[index] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a category
 */
async function deleteCategory(id) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories = result[STORAGE_KEYS.CATEGORIES] || [];
    
    const filtered = categories.filter(c => c.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: filtered });
    
    // Also remove category from bookmarks
    const bookmarksResult = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = bookmarksResult[STORAGE_KEYS.BOOKMARKS] || [];
    
    const updatedBookmarks = bookmarks.map(b => {
      if (b.categoryId === id) {
        delete b.categoryId;
      }
      return b;
    });
    
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updatedBookmarks });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Get all tags
 */
async function getTags() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    return { success: true, tags: result[STORAGE_KEYS.TAGS] || [] };
  } catch (error) {
    return { success: false, error: error.message, tags: [] };
  }
}

/**
 * Add a tag
 */
async function addTag(tag) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = result[STORAGE_KEYS.TAGS] || [];
    
    const newTag = {
      id: generateId(),
      name: tag.name,
      color: tag.color || '#10b981',
      createdAt: new Date().toISOString()
    };
    
    tags.push(newTag);
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
    
    return { success: true, tag: newTag };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Update a tag
 */
async function updateTag(id, updates) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = result[STORAGE_KEYS.TAGS] || [];
    
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) {
      return { success: false, error: 'Tag not found' };
    }
    
    tags[index] = { ...tags[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
    
    return { success: true, tag: tags[index] };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Delete a tag
 */
async function deleteTag(id) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags = result[STORAGE_KEYS.TAGS] || [];
    
    const filtered = tags.filter(t => t.id !== id);
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: filtered });
    
    // Also remove tag from bookmarks
    const bookmarksResult = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = bookmarksResult[STORAGE_KEYS.BOOKMARKS] || [];
    
    const updatedBookmarks = bookmarks.map(b => {
      if (b.tagIds && b.tagIds.includes(id)) {
        b.tagIds = b.tagIds.filter(tid => tid !== id);
      }
      return b;
    });
    
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updatedBookmarks });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Assign a category to a bookmark
 */
async function assignCategory(bookmarkId, categoryId) {
  return await updateBookmark(bookmarkId, { categoryId });
}

/**
 * Add a tag to a bookmark
 */
async function addTagToBookmark(bookmarkId, tagId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) {
      return { success: false, error: 'Bookmark not found' };
    }
    
    if (!bookmarks[index].tagIds) {
      bookmarks[index].tagIds = [];
    }
    
    if (!bookmarks[index].tagIds.includes(tagId)) {
      bookmarks[index].tagIds.push(tagId);
    }
    
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Remove a tag from a bookmark
 */
async function removeTagFromBookmark(bookmarkId, tagId) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) {
      return { success: false, error: 'Bookmark not found' };
    }
    
    if (bookmarks[index].tagIds) {
      bookmarks[index].tagIds = bookmarks[index].tagIds.filter(id => id !== tagId);
    }
    
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Export bookmarks
 */
async function exportBookmarks(format) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    // Get categories and tags for enrichment
    const categoriesResult = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const tagsResult = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    
    const categories = categoriesResult[STORAGE_KEYS.CATEGORIES] || [];
    const tags = tagsResult[STORAGE_KEYS.TAGS] || [];
    
    // Enrich bookmarks with category and tag names
    const enrichedBookmarks = bookmarks.map(b => {
      const enriched = { ...b };
      
      if (b.categoryId) {
        const category = categories.find(c => c.id === b.categoryId);
        enriched.categoryName = category ? category.name : '';
      }
      
      if (b.tagIds) {
        enriched.tagNames = b.tagIds.map(tid => {
          const tag = tags.find(t => t.id === tid);
          return tag ? tag.name : '';
        }).filter(Boolean);
      }
      
      return enriched;
    });
    
    if (format === 'json') {
      return {
        success: true,
        data: JSON.stringify(enrichedBookmarks, null, 2),
        filename: `bookmarks-${Date.now()}.json`
      };
    } else {
      // CSV format
      const headers = [
        'ID', 'Text', 'Author Name', 'Author Handle', 'Tweet URL',
        'Date Bookmarked', 'Created At', 'Category', 'Tags', 'Has Media'
      ];
      
      const rows = enrichedBookmarks.map(b => [
        b.id,
        `"${(b.text || '').replace(/"/g, '""')}"`,
        `"${(b.authorName || '').replace(/"/g, '""')}"`,
        `"${(b.authorHandle || '').replace(/"/g, '""')}"`,
        b.tweetUrl || '',
        b.dateBookmarked || '',
        b.createdAt || '',
        `"${b.categoryName || ''}"`,
        `"${(b.tagNames || []).join(', ')}"`,
        b.media && b.media.length > 0 ? 'Yes' : 'No'
      ].join(','));
      
      return {
        success: true,
        data: [headers.join(','), ...rows].join('\n'),
        filename: `bookmarks-${Date.now()}.csv`
      };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search bookmarks
 */
async function searchBookmarks(query) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    let bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    
    if (query && query.trim()) {
      const searchTerm = query.toLowerCase().trim();
      bookmarks = bookmarks.filter(b =>
        (b.text && b.text.toLowerCase().includes(searchTerm)) ||
        (b.authorName && b.authorName.toLowerCase().includes(searchTerm)) ||
        (b.authorHandle && b.authorHandle.toLowerCase().includes(searchTerm)) ||
        (b.hashtags && b.hashtags.some(h => h.toLowerCase().includes(searchTerm))) ||
        (b.mentions && b.mentions.some(m => m.toLowerCase().includes(searchTerm)))
      );
    }
    
    // Sort by date bookmarked
    bookmarks.sort((a, b) => 
      new Date(b.dateBookmarked) - new Date(a.dateBookmarked)
    );
    
    return { success: true, bookmarks };
  } catch (error) {
    return { success: false, error: error.message, bookmarks: [] };
  }
}

/**
 * Get statistics
 */
async function getStats() {
  try {
    const result = await chrome.storage.local.get([
      STORAGE_KEYS.BOOKMARKS,
      STORAGE_KEYS.CATEGORIES,
      STORAGE_KEYS.TAGS
    ]);
    
    const bookmarks = result[STORAGE_KEYS.BOOKMARKS] || [];
    const categories = result[STORAGE_KEYS.CATEGORIES] || [];
    const tags = result[STORAGE_KEYS.TAGS] || [];
    
    // Count bookmarks with categories and tags
    const withCategory = bookmarks.filter(b => b.categoryId).length;
    const withTags = bookmarks.filter(b => b.tagIds && b.tagIds.length > 0).length;
    
    return {
      success: true,
      stats: {
        totalBookmarks: bookmarks.length,
        totalCategories: categories.length,
        totalTags: tags.length,
        withCategory,
        withTags
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

// Initialize storage on load
initializeStorage();

console.log('Bookmarkd: Background service worker loaded');