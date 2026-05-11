interface Bookmark {
  id: string;
  text: string;
  authorName: string;
  authorHandle: string;
  authorAvatar?: string;
  tweetUrl: string;
  dateBookmarked: string;
  createdAt: string;
  media?: Array<{ type: string; url: string }>;
  mediaType: string;
  hashtags?: string[];
  mentions?: string[];
  categoryId?: string | null;
  tagIds?: string[];
}

interface Category {
  id: string;
  name: string;
  color: string;
  keywords: string[];
  createdAt: string;
}

interface Tag {
  id: string;
  name: string;
  color: string;
  createdAt: string;
}

const STORAGE_KEYS = {
  BOOKMARKS: 'bookmarks',
  CATEGORIES: 'categories',
  TAGS: 'tags',
} as const;

async function initializeStorage() {
  const result = await chrome.storage.local.get([
    STORAGE_KEYS.BOOKMARKS,
    STORAGE_KEYS.CATEGORIES,
    STORAGE_KEYS.TAGS,
  ]);
  if (!result[STORAGE_KEYS.BOOKMARKS]) await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: [] });
  if (!result[STORAGE_KEYS.CATEGORIES]) await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: [] });
  if (!result[STORAGE_KEYS.TAGS]) await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: [] });
}

chrome.runtime.onInstalled.addListener((details) => {
  initializeStorage();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  if (details.reason === 'install' || details.reason === 'update') {
    chrome.tabs.create({ url: chrome.runtime.getURL('welcome.html') });
  }
});

chrome.runtime.onStartup.addListener(() => {
  initializeStorage();
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && typeof message.action === 'string' && message.action === 'CLOSE_WELCOME_TAB') {
    const tabId = sender.tab?.id;
    if (typeof tabId === 'number') {
      chrome.tabs.remove(tabId);
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'No tab ID available' });
    }
    return true;
  }

  handleMessage(message).then(sendResponse);
  return true;
});

async function handleMessage(message: { action: string; data?: Record<string, unknown> }) {
  const { action, data = {} } = message;

  switch (action) {
    case 'BOOKMARKS_CAPTURED': return saveBookmarks(data.bookmarks as Bookmark[]);
    case 'GET_BOOKMARKS':      return getBookmarks(data);
    case 'ADD_BOOKMARK':       return addBookmark(data.bookmark as Bookmark);
    case 'UPDATE_BOOKMARK':    return updateBookmark(data.id as string, data.updates as Partial<Bookmark>);
    case 'DELETE_BOOKMARK':    return deleteBookmark(data.id as string);
    case 'GET_CATEGORIES':     return getCategories();
    case 'ADD_CATEGORY':       return addCategory(data.category as Omit<Category, 'id' | 'createdAt'>);
    case 'UPDATE_CATEGORY':    return updateCategory(data.id as string, data.updates as Partial<Category>);
    case 'DELETE_CATEGORY':    return deleteCategory(data.id as string);
    case 'GET_TAGS':           return getTags();
    case 'ADD_TAG':            return addTag(data.tag as Omit<Tag, 'id' | 'createdAt'>);
    case 'UPDATE_TAG':         return updateTag(data.id as string, data.updates as Partial<Tag>);
    case 'DELETE_TAG':         return deleteTag(data.id as string);
    case 'ASSIGN_CATEGORY':    return assignCategory(data.bookmarkId as string, data.categoryId as string | null);
    case 'ADD_TAG_TO_BOOKMARK':    return addTagToBookmark(data.bookmarkId as string, data.tagId as string);
    case 'REMOVE_TAG_FROM_BOOKMARK': return removeTagFromBookmark(data.bookmarkId as string, data.tagId as string);
    case 'EXPORT_BOOKMARKS':   return exportBookmarks(data.format as 'json' | 'csv');
    case 'IMPORT_BOOKMARKS':   return importBookmarks(data.bookmarks as Record<string, unknown>[]);
    case 'SEARCH_BOOKMARKS':   return searchBookmarks(data.query as string);
    case 'GET_STATS':          return getStats();
    case 'RECATEGORIZE_BOOKMARKS': return recategorizeBookmarks();
    case 'SCROLL_PROGRESS':
    case 'SCROLL_COMPLETE':    return { success: true };
    default:                   return { success: false, error: 'Unknown action' };
  }
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function importBookmarks(imported: Record<string, unknown>[]) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.BOOKMARKS, STORAGE_KEYS.CATEGORIES, STORAGE_KEYS.TAGS]);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    const tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];

    const existingIds = new Set(bookmarks.map(b => b.id));
    const tagColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6'];
    let added = 0;
    let skipped = 0;

    for (const item of imported) {
      const id = item.id as string;
      if (!id) continue;
      if (existingIds.has(id)) { skipped++; continue; }

      const bookmark: Bookmark = {
        id,
        text: (item.text as string) || '',
        authorName: (item.authorName as string) || '',
        authorHandle: (item.authorHandle as string) || '',
        authorAvatar: item.authorAvatar as string | undefined,
        tweetUrl: (item.tweetUrl as string) || '',
        dateBookmarked: (item.dateBookmarked as string) || new Date().toISOString(),
        createdAt: (item.createdAt as string) || new Date().toISOString(),
        media: (item.media as Bookmark['media']) || [],
        mediaType: (item.mediaType as Bookmark['mediaType']) || 'post',
        hashtags: (item.hashtags as string[]) || [],
        mentions: (item.mentions as string[]) || [],
      };

      // Re-link category by name
      const categoryName = item.categoryName as string | undefined;
      if (categoryName) {
        let cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
        if (!cat) {
          cat = { id: generateId(), name: categoryName, color: '#6366f1', keywords: [], createdAt: new Date().toISOString() };
          categories.push(cat);
        }
        bookmark.categoryId = cat.id;
      }

      // Re-link tags by name
      const tagNames = item.tagNames as string[] | undefined;
      if (tagNames && tagNames.length > 0) {
        bookmark.tagIds = [];
        for (const tagName of tagNames) {
          let tag = tags.find(t => t.name.toLowerCase() === tagName.toLowerCase());
          if (!tag) {
            tag = { id: generateId(), name: tagName, color: tagColors[tags.length % tagColors.length], createdAt: new Date().toISOString() };
            tags.push(tag);
          }
          bookmark.tagIds.push(tag.id);
        }
      }

      bookmarks.push(bookmark);
      existingIds.add(id);
      added++;
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.BOOKMARKS]: bookmarks,
      [STORAGE_KEYS.CATEGORIES]: categories,
      [STORAGE_KEYS.TAGS]: tags,
    });

    return { success: true, added, skipped };
  } catch (error) {
    return { success: false, error: (error as Error).message, added: 0, skipped: 0 };
  }
}

function autoCategorize(bookmark: Bookmark, categories: Category[]): string | null {
  const text = (bookmark.text || '').toLowerCase();
  const hashtags = (bookmark.hashtags || []).map(h => h.toLowerCase());
  for (const cat of categories) {
    for (const kw of cat.keywords ?? []) {
      if (text.includes(kw) || hashtags.includes(kw)) return cat.id;
    }
  }
  return null;
}

async function saveBookmarks(bookmarks: Bookmark[]) {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.BOOKMARKS, STORAGE_KEYS.TAGS, STORAGE_KEYS.CATEGORIES]);
    const existingBookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    let tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];

    const newBookmarks: Bookmark[] = [];
    const updatedExisting = [...existingBookmarks];

    for (const b of bookmarks) {
      const idx = updatedExisting.findIndex(eb => eb.id === b.id);
      if (idx === -1) {
        newBookmarks.push(b);
      } else if (!updatedExisting[idx].authorName && b.authorName) {
        updatedExisting[idx] = { ...updatedExisting[idx], authorName: b.authorName, authorHandle: b.authorHandle, authorAvatar: b.authorAvatar };
      }
    }

    const tagColors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#0ea5e9', '#14b8a6'];
    let tagsChanged = false;
    for (const bookmark of newBookmarks) {
      if (!bookmark.hashtags?.length) continue;
      if (!bookmark.tagIds) bookmark.tagIds = [];
      for (const hashtag of bookmark.hashtags) {
        const lower = hashtag.toLowerCase();
        let tag = tags.find(t => t.name.toLowerCase() === lower);
        if (!tag) {
          tag = { id: generateId(), name: hashtag, color: tagColors[tags.length % tagColors.length], createdAt: new Date().toISOString() };
          tags.push(tag);
          tagsChanged = true;
        }
        if (!bookmark.tagIds.includes(tag.id)) bookmark.tagIds.push(tag.id);
      }
    }

    if (tagsChanged) await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });

    for (const bookmark of newBookmarks) {
      if (!bookmark.categoryId) {
        const catId = autoCategorize(bookmark, categories);
        if (catId) bookmark.categoryId = catId;
      }
    }

    const updatedBookmarks = [...updatedExisting, ...newBookmarks];
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updatedBookmarks });
    return { success: true, added: newBookmarks.length };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function getBookmarks(filters: { categoryId?: string; tagId?: string } = {}) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    let bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    if (filters.categoryId) bookmarks = bookmarks.filter(b => b.categoryId === filters.categoryId);
    if (filters.tagId) bookmarks = bookmarks.filter(b => b.tagIds?.includes(filters.tagId!));
    bookmarks.sort((a, b) => new Date(b.dateBookmarked).getTime() - new Date(a.dateBookmarked).getTime());
    return { success: true, bookmarks };
  } catch (error) {
    return { success: false, error: (error as Error).message, bookmarks: [] };
  }
}

async function addBookmark(bookmark: Bookmark) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    if (bookmarks.some(b => b.id === bookmark.id)) return { success: false, error: 'Bookmark already exists' };
    bookmarks.push(bookmark);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    return { success: true, bookmark };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function updateBookmark(id: string, updates: Partial<Bookmark>) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const index = bookmarks.findIndex(b => b.id === id);
    if (index === -1) return { success: false, error: 'Bookmark not found' };
    bookmarks[index] = { ...bookmarks[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    return { success: true, bookmark: bookmarks[index] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function deleteBookmark(id: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks.filter(b => b.id !== id) });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function getCategories() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    return { success: true, categories: result[STORAGE_KEYS.CATEGORIES] || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message, categories: [] };
  }
}

async function addCategory(category: Omit<Category, 'id' | 'createdAt'>) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    const newCategory: Category = {
      id: generateId(),
      name: category.name,
      color: category.color || '#6366f1',
      keywords: category.keywords || [],
      createdAt: new Date().toISOString(),
    };
    categories.push(newCategory);
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
    return { success: true, category: newCategory };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function updateCategory(id: string, updates: Partial<Category>) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    const index = categories.findIndex(c => c.id === id);
    if (index === -1) return { success: false, error: 'Category not found' };
    categories[index] = { ...categories[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories });
    return { success: true, category: categories[index] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function deleteCategory(id: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.CATEGORIES);
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    await chrome.storage.local.set({ [STORAGE_KEYS.CATEGORIES]: categories.filter(c => c.id !== id) });

    const bookmarksResult = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = bookmarksResult[STORAGE_KEYS.BOOKMARKS] || [];
    const updated = bookmarks.map(b => b.categoryId === id ? { ...b, categoryId: null } : b);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updated });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function getTags() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    return { success: true, tags: result[STORAGE_KEYS.TAGS] || [] };
  } catch (error) {
    return { success: false, error: (error as Error).message, tags: [] };
  }
}

async function addTag(tag: Omit<Tag, 'id' | 'createdAt'>) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];
    const newTag: Tag = { id: generateId(), name: tag.name, color: tag.color || '#10b981', createdAt: new Date().toISOString() };
    tags.push(newTag);
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
    return { success: true, tag: newTag };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function updateTag(id: string, updates: Partial<Tag>) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];
    const index = tags.findIndex(t => t.id === id);
    if (index === -1) return { success: false, error: 'Tag not found' };
    tags[index] = { ...tags[index], ...updates };
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags });
    return { success: true, tag: tags[index] };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function deleteTag(id: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAGS);
    const tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];
    await chrome.storage.local.set({ [STORAGE_KEYS.TAGS]: tags.filter(t => t.id !== id) });

    const bookmarksResult = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = bookmarksResult[STORAGE_KEYS.BOOKMARKS] || [];
    const updated = bookmarks.map(b => ({
      ...b,
      tagIds: b.tagIds ? b.tagIds.filter(tid => tid !== id) : [],
    }));
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updated });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function assignCategory(bookmarkId: string, categoryId: string | null) {
  return updateBookmark(bookmarkId, { categoryId });
}

async function addTagToBookmark(bookmarkId: string, tagId: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return { success: false, error: 'Bookmark not found' };
    if (!bookmarks[index].tagIds) bookmarks[index].tagIds = [];
    if (!bookmarks[index].tagIds!.includes(tagId)) bookmarks[index].tagIds!.push(tagId);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function removeTagFromBookmark(bookmarkId: string, tagId: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const index = bookmarks.findIndex(b => b.id === bookmarkId);
    if (index === -1) return { success: false, error: 'Bookmark not found' };
    bookmarks[index].tagIds = (bookmarks[index].tagIds ?? []).filter(id => id !== tagId);
    await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: bookmarks });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function recategorizeBookmarks() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.BOOKMARKS, STORAGE_KEYS.CATEGORIES]);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    let changed = 0;
    const updated = bookmarks.map(b => {
      const catId = autoCategorize(b, categories);
      if (catId && b.categoryId !== catId) { changed++; return { ...b, categoryId: catId }; }
      return b;
    });
    if (changed > 0) await chrome.storage.local.set({ [STORAGE_KEYS.BOOKMARKS]: updated });
    return { success: true, changed };
  } catch (error) {
    return { success: false, error: (error as Error).message, changed: 0 };
  }
}

async function exportBookmarks(format: 'json' | 'csv') {
  try {
    const [bookmarksResult, categoriesResult, tagsResult] = await Promise.all([
      chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS),
      chrome.storage.local.get(STORAGE_KEYS.CATEGORIES),
      chrome.storage.local.get(STORAGE_KEYS.TAGS),
    ]);
    const bookmarks: Bookmark[] = bookmarksResult[STORAGE_KEYS.BOOKMARKS] || [];
    const categories: Category[] = categoriesResult[STORAGE_KEYS.CATEGORIES] || [];
    const tags: Tag[] = tagsResult[STORAGE_KEYS.TAGS] || [];

    const enriched = bookmarks.map(b => ({
      ...b,
      categoryName: b.categoryId ? (categories.find(c => c.id === b.categoryId)?.name ?? '') : '',
      tagNames: (b.tagIds ?? []).map(tid => tags.find(t => t.id === tid)?.name ?? '').filter(Boolean),
    }));

    if (format === 'json') {
      return { success: true, data: JSON.stringify(enriched, null, 2), filename: `bookmarks-${Date.now()}.json` };
    }

    const headers = ['ID','Text','Author Name','Author Handle','Tweet URL','Date Bookmarked','Created At','Category','Tags','Has Media'];
    const rows = enriched.map(b => [
      b.id,
      `"${(b.text || '').replace(/"/g, '""')}"`,
      `"${(b.authorName || '').replace(/"/g, '""')}"`,
      `"${(b.authorHandle || '').replace(/"/g, '""')}"`,
      b.tweetUrl || '',
      b.dateBookmarked || '',
      b.createdAt || '',
      `"${b.categoryName}"`,
      `"${b.tagNames.join(', ')}"`,
      b.media && b.media.length > 0 ? 'Yes' : 'No',
    ].join(','));

    return { success: true, data: [headers.join(','), ...rows].join('\n'), filename: `bookmarks-${Date.now()}.csv` };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

async function searchBookmarks(query: string) {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.BOOKMARKS);
    let bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    if (query?.trim()) {
      const q = query.toLowerCase().trim();
      bookmarks = bookmarks.filter(b =>
        b.text?.toLowerCase().includes(q) ||
        b.authorName?.toLowerCase().includes(q) ||
        b.authorHandle?.toLowerCase().includes(q) ||
        b.hashtags?.some(h => h.toLowerCase().includes(q)) ||
        b.mentions?.some(m => m.toLowerCase().includes(q))
      );
    }
    bookmarks.sort((a, b) => new Date(b.dateBookmarked).getTime() - new Date(a.dateBookmarked).getTime());
    return { success: true, bookmarks };
  } catch (error) {
    return { success: false, error: (error as Error).message, bookmarks: [] };
  }
}

async function getStats() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEYS.BOOKMARKS, STORAGE_KEYS.CATEGORIES, STORAGE_KEYS.TAGS]);
    const bookmarks: Bookmark[] = result[STORAGE_KEYS.BOOKMARKS] || [];
    const categories: Category[] = result[STORAGE_KEYS.CATEGORIES] || [];
    const tags: Tag[] = result[STORAGE_KEYS.TAGS] || [];
    return {
      success: true,
      stats: {
        totalBookmarks: bookmarks.length,
        totalCategories: categories.length,
        totalTags: tags.length,
        withCategory: bookmarks.filter(b => b.categoryId).length,
        withTags: bookmarks.filter(b => b.tagIds && b.tagIds.length > 0).length,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

initializeStorage();
