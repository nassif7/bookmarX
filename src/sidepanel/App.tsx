import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppSettings, Bookmark, Category, Tag, ToastItem } from '../types';
import { sendMessage } from './lib/chrome';
import { darkenHex, hexToRgba } from './lib/utils';
import TopBar from './components/TopBar';
import SearchRow from './components/SearchRow';
import PillsRow from './components/PillsRow';
import FiltersRow from './components/FiltersRow';
import BookmarkList from './components/BookmarkList';
import EmptyState from './components/EmptyState';
import SyncOverlay from './components/SyncOverlay';
import Footer from './components/Footer';
import SettingsPanel from './components/SettingsPanel';
import CollectionsPanel from './components/CollectionsPanel';
import CategoryModal from './components/CategoryModal';
import BookmarkDetailModal from './components/BookmarkDetailModal';
import Onboarding from './components/Onboarding';
import ToastContainer from './components/ToastContainer';

const DEFAULT_ACCENT = '#1d9bf0';

export default function App() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ theme: 'system', accent: DEFAULT_ACCENT });
  const [activeCategory, setActiveCategory] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncCount, setSyncCount] = useState(0);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [ready, setReady] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [detailBookmark, setDetailBookmark] = useState<Bookmark | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addToast = useCallback((message: string, type: ToastItem['type'] = 'success') => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const applyTheme = useCallback((theme: string) => {
    const root = document.documentElement;
    if (theme === 'dark') root.setAttribute('data-theme', 'dark');
    else if (theme === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme');
  }, []);

  const applyAccent = useCallback((color: string) => {
    const root = document.documentElement;
    root.style.setProperty('--accent', color);
    root.style.setProperty('--accent-hover', darkenHex(color, 18));
    root.style.setProperty('--accent-muted', hexToRgba(color, 0.12));
  }, []);

  const loadData = useCallback(async () => {
    const [br, cr, tr] = await Promise.all([
      sendMessage<{ bookmarks: Bookmark[] }>({ action: 'GET_BOOKMARKS', data: {} }),
      sendMessage<{ categories: Category[] }>({ action: 'GET_CATEGORIES', data: {} }),
      sendMessage<{ tags: Tag[] }>({ action: 'GET_TAGS', data: {} }),
    ]);
    setBookmarks(br.bookmarks ?? []);
    setCategories(cr.categories ?? []);
    setTags(tr.tags ?? []);
  }, []);

  // Init on mount
  useEffect(() => {
    (async () => {
      const { appSettings } = await chrome.storage.local.get('appSettings');
      const s: AppSettings = appSettings ?? { theme: 'system', accent: DEFAULT_ACCENT };
      setSettings(s);
      applyTheme(s.theme);
      applyAccent(s.accent);

      const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
      if (onboardingComplete) {
        await loadData();
        setOnboardingDone(true);
      }
      setReady(true);
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for sync completion from content script
  useEffect(() => {
    const handler = (msg: { action: string; data?: { stoppedEarly?: boolean } }) => {
      if (msg.action !== 'SCROLL_COMPLETE') return;
      if (syncPollRef.current) clearInterval(syncPollRef.current);
      setIsSyncing(false);
      setLastSynced(new Date());
      loadData().then(() => {
        const label = msg.data?.stoppedEarly
          ? 'Caught up — only new bookmarks fetched'
          : 'Sync complete';
        addToast(label, 'success');
      });
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, [loadData, addToast]);

  useEffect(() => { applyTheme(settings.theme); }, [settings.theme, applyTheme]);
  useEffect(() => { applyAccent(settings.accent); }, [settings.accent, applyAccent]);

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const updated = { ...settings, ...patch };
    setSettings(updated);
    await chrome.storage.local.set({ appSettings: updated });
  };

  const startSync = async () => {
    if (isSyncing) return;
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => [] as chrome.tabs.Tab[]);
    if (!tab?.url) { addToast('Could not access current tab', 'error'); return; }
    if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
      addToast('Open x.com first, then sync', 'warning'); return;
    }
    try {
      await new Promise<void>((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id!, { action: 'START_AUTO_SCROLL' }, () => {
          if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
          else resolve();
        });
      });
    } catch {
      addToast('Could not reach x.com — try refreshing it', 'error'); return;
    }
    setIsSyncing(true);
    setSyncCount(0);
    syncPollRef.current = setInterval(async () => {
      const r = await chrome.storage.local.get('bookmarks');
      setSyncCount((r.bookmarks as Bookmark[] ?? []).length);
    }, 1000);
  };

  const stopSync = () => {
    if (syncPollRef.current) clearInterval(syncPollRef.current);
    setIsSyncing(false);
    loadData();
  };

  const applyBaseFilters = (list: Bookmark[]): Bookmark[] => {
    if (activeCategory === 'uncategorized') list = list.filter(b => !b.categoryId);
    else if (activeCategory) list = list.filter(b => b.categoryId === activeCategory);
    if (typeFilter) list = list.filter(b => b.mediaType === typeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(b =>
        b.text?.toLowerCase().includes(q) ||
        b.authorName?.toLowerCase().includes(q) ||
        b.authorHandle?.toLowerCase().includes(q) ||
        b.hashtags?.some(h => h.toLowerCase().includes(q))
      );
    }
    return list;
  };

  const getFilteredBookmarks = (): Bookmark[] => {
    let list = applyBaseFilters(bookmarks);
    if (tagFilter) list = list.filter(b => b.tagIds?.includes(tagFilter));
    return list;
  };

  const getAvailableTags = (): Tag[] => {
    const base = applyBaseFilters(bookmarks);
    const usedIds = new Set(base.flatMap(b => b.tagIds ?? []));
    return tags.filter(t => usedIds.has(t.id));
  };

  const openCategoryModal = (cat: Category | null = null) => {
    setEditingCategory(cat);
    setShowCategoryModal(true);
  };

  const saveCategory = async (data: { name: string; color: string; keywords: string[] }) => {
    if (editingCategory) {
      await sendMessage({ action: 'UPDATE_CATEGORY', data: { id: editingCategory.id, updates: data } });
      addToast('Collection updated', 'success');
    } else {
      await sendMessage({ action: 'ADD_CATEGORY', data: { category: data } });
      addToast('Collection created', 'success');
    }
    setShowCategoryModal(false);
    await loadData();
  };

  const deleteCategory = async (id: string) => {
    await sendMessage({ action: 'DELETE_CATEGORY', data: { id } });
    if (activeCategory === id) setActiveCategory('');
    addToast('Collection deleted', 'success');
    await loadData();
  };

  const recategorizeAll = async () => {
    const r = await sendMessage<{ changed: number }>({ action: 'RECATEGORIZE_BOOKMARKS', data: {} });
    await loadData();
    addToast(`Re-sorted — ${r.changed} bookmark${r.changed !== 1 ? 's' : ''} updated`, 'success');
  };

  const assignCategory = async (bookmarkId: string, categoryId: string | null) => {
    await sendMessage({ action: 'ASSIGN_CATEGORY', data: { bookmarkId, categoryId } });
    await loadData();
    setDetailBookmark(prev => prev?.id === bookmarkId ? { ...prev, categoryId } : prev);
  };

  const exportBookmarks = async (format: 'json' | 'csv') => {
    const r = await sendMessage<{ success: boolean; data: string; filename: string }>({
      action: 'EXPORT_BOOKMARKS', data: { format },
    });
    if (!r.success) { addToast('Export failed', 'error'); return; }
    const blob = new Blob([r.data], { type: format === 'json' ? 'application/json' : 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: r.filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`Exported as ${format.toUpperCase()}`, 'success');
  };

  const handleImport = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) { addToast('Invalid file — expected a JSON array', 'error'); return; }
      const r = await sendMessage<{ success: boolean; added: number; skipped: number; error?: string }>({
        action: 'IMPORT_BOOKMARKS', data: { bookmarks: data },
      });
      if (!r.success) { addToast(r.error ?? 'Import failed', 'error'); return; }
      await loadData();
      const msg = `Imported ${r.added} bookmark${r.added !== 1 ? 's' : ''}` +
        (r.skipped > 0 ? ` · ${r.skipped} already existed` : '');
      addToast(msg, 'success');
    } catch {
      addToast('Could not read file — make sure it is a valid JSON export', 'error');
    }
  };

  const createCategoryForDetail = async (data: { name: string; color: string; keywords: string[] }): Promise<Category> => {
    const r = await sendMessage<{ category: Category }>({ action: 'ADD_CATEGORY', data: { category: data } });
    addToast('Collection created', 'success');
    await loadData();
    return r.category;
  };

  const completeOnboarding = async (selectedCategories: Array<{ name: string; color: string; keywords: string[] }>) => {
    for (const cat of selectedCategories) {
      await sendMessage({ action: 'ADD_CATEGORY', data: { category: cat } });
    }
    await chrome.storage.local.set({ onboardingComplete: true });
    await loadData();
    setOnboardingDone(true);
    startSync();
  };

  const skipOnboarding = async () => {
    await chrome.storage.local.set({ onboardingComplete: true });
    await loadData();
    setOnboardingDone(true);
  };

  if (!ready) return null;

  if (!onboardingDone) {
    return <Onboarding onComplete={completeOnboarding} onSkip={skipOnboarding} />;
  }

  const filtered = getFilteredBookmarks();
  const availableTags = getAvailableTags();

  return (
    <div className="app">
      <TopBar onSettings={() => setShowSettings(true)} />
      <SearchRow
        query={searchQuery}
        onSearch={setSearchQuery}
        onSync={startSync}
        isSyncing={isSyncing}
      />
      <PillsRow
        categories={categories}
        bookmarks={bookmarks}
        activeCategory={activeCategory}
        onChange={(cat) => { setActiveCategory(cat); setTagFilter(''); }}
      />
      <FiltersRow
        tags={availableTags}
        tagFilter={tagFilter}
        typeFilter={typeFilter}
        onTagFilter={setTagFilter}
        onTypeFilter={setTypeFilter}
      />
      {filtered.length === 0 ? (
        <EmptyState onSync={startSync} />
      ) : (
        <BookmarkList
          bookmarks={filtered}
          categories={categories}
          onBookmarkClick={(id) => {
            const b = bookmarks.find(x => x.id === id);
            if (b) setDetailBookmark(b);
          }}
        />
      )}
      {isSyncing && <SyncOverlay count={syncCount} onStop={stopSync} />}
      <Footer
        bookmarkCount={bookmarks.length}
        categoryCount={categories.length}
        lastSynced={lastSynced}
        onExport={() => exportBookmarks('json')}
        onImport={handleImport}
        onManage={() => setShowCollections(true)}
      />
      {showSettings && (
        <SettingsPanel
          theme={settings.theme}
          accent={settings.accent}
          onClose={() => setShowSettings(false)}
          onTheme={(t) => saveSettings({ theme: t as AppSettings['theme'] })}
          onAccent={(c) => saveSettings({ accent: c })}
          onSync={() => { setShowSettings(false); startSync(); }}
          onExportJson={() => { setShowSettings(false); exportBookmarks('json'); }}
          onExportCsv={() => { setShowSettings(false); exportBookmarks('csv'); }}
          onImport={handleImport}
          onManage={() => { setShowSettings(false); setShowCollections(true); }}
        />
      )}
      {showCollections && (
        <CollectionsPanel
          categories={categories}
          bookmarks={bookmarks}
          onClose={() => setShowCollections(false)}
          onAdd={() => openCategoryModal()}
          onEdit={openCategoryModal}
          onDelete={deleteCategory}
          onRecategorize={recategorizeAll}
        />
      )}
      {showCategoryModal && (
        <CategoryModal
          category={editingCategory}
          onClose={() => setShowCategoryModal(false)}
          onSave={saveCategory}
        />
      )}
      {detailBookmark && (
        <BookmarkDetailModal
          bookmark={detailBookmark}
          categories={categories}
          tags={tags}
          onClose={() => setDetailBookmark(null)}
          onAssignCategory={assignCategory}
          onCreateCategory={createCategoryForDetail}
        />
      )}
      <ToastContainer toasts={toasts} />
    </div>
  );
}
