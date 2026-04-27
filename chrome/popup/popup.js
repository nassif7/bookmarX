// BookmarX popup — Spotlight redesign

const SUGGESTED_CATEGORIES = [
  { name: 'Tech',     color: '#6366f1', keywords: ['javascript','typescript','python','react','nodejs','github','coding','programming','developer','software'] },
  { name: 'AI & ML',  color: '#8b5cf6', keywords: ['ai','gpt','llm','openai','claude','chatgpt','machine learning','neural','gemini','deepmind'] },
  { name: 'Design',   color: '#ec4899', keywords: ['design','ux','ui','figma','css','typography','branding','animation','interface'] },
  { name: 'Business', color: '#f59e0b', keywords: ['startup','founder','entrepreneurship','saas','product','growth','revenue','b2b','marketing'] },
  { name: 'Finance',  color: '#10b981', keywords: ['crypto','bitcoin','stocks','investing','trading','finance','web3','defi','eth'] },
  { name: 'Science',  color: '#0ea5e9', keywords: ['research','science','biology','physics','chemistry','study','paper','space','climate'] },
  { name: 'Health',   color: '#ef4444', keywords: ['fitness','nutrition','health','workout','wellness','mindfulness','diet','sleep'] },
  { name: 'News',     color: '#6b7280', keywords: ['politics','economy','election','news','breaking','government','policy'] },
];

// ── State ────────────────────────────────────────────────────
let state = {
  bookmarks: [],
  categories: [],
  tags: [],
  activeCategory: '',      // '' = All, 'uncategorized' = no collection
  tagFilter: '',
  typeFilter: '',
  searchQuery: '',
  editingCategory: null,
};

let isSyncing = false;
let syncPollInterval = null;
let onboardingCategories = [];

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.action === 'SCROLL_COMPLETE') {
    clearInterval(syncPollInterval);
    isSyncing = false;
    setSyncOverlay(false);
    loadData().then(() => {
      render();
      const label = msg.data?.stoppedEarly ? 'Caught up — only new bookmarks fetched' : `Sync complete`;
      showToast(`${label} · ${state.bookmarks.length} total`, 'success');
    });
  }
});

async function init() {
  await loadSettings();
  const { onboardingComplete } = await chrome.storage.local.get('onboardingComplete');
  if (!onboardingComplete) {
    showOnboarding();
    return;
  }
  attachListeners();
  await loadData();
  render();
}

// ── Settings (theme + accent) ────────────────────────────────
const DEFAULT_ACCENT = '#f97316';

async function loadSettings() {
  const { appSettings } = await chrome.storage.local.get('appSettings');
  const s = appSettings || {};
  applyTheme(s.theme || 'system');
  applyAccent(s.accent || DEFAULT_ACCENT);
}

async function saveSettings(patch) {
  const { appSettings } = await chrome.storage.local.get('appSettings');
  const updated = { ...(appSettings || {}), ...patch };
  await chrome.storage.local.set({ appSettings: updated });
}

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'dark')  { root.setAttribute('data-theme', 'dark'); }
  else if (theme === 'light') { root.setAttribute('data-theme', 'light'); }
  else { root.removeAttribute('data-theme'); }

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
}

function applyAccent(color) {
  const root = document.documentElement;
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-hover', darkenHex(color, 18));
  root.style.setProperty('--accent-muted', hexToRgba(color, 0.12));

  document.querySelectorAll('.accent-swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.color === color);
  });
  const custom = document.getElementById('accentCustom');
  if (custom) custom.value = color;
}

function darkenHex(hex, amount) {
  const n = parseInt(hex.replace('#',''), 16);
  const r = Math.max(0, (n >> 16) - amount);
  const g = Math.max(0, ((n >> 8) & 0xff) - amount);
  const b = Math.max(0, (n & 0xff) - amount);
  return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join('');
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.replace('#',''), 16);
  return `rgba(${n >> 16},${(n >> 8) & 0xff},${n & 0xff},${alpha})`;
}

// ── Onboarding ───────────────────────────────────────────────
const CHECK_SVG = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;

function showOnboarding() {
  onboardingCategories = SUGGESTED_CATEGORIES.map(c => ({ ...c, keywords: [...c.keywords], selected: true, isCustom: false }));
  document.getElementById('app').style.display = 'none';
  document.getElementById('onboarding').style.display = 'flex';
  // Onboarding doesn't have settings panel, nothing else needed
  renderOnboardingList();

  document.getElementById('onboardingDoneBtn').addEventListener('click', completeOnboarding);
  document.getElementById('onboardingSkipBtn').addEventListener('click', skipOnboarding);
  document.getElementById('onboardingAddBtn').addEventListener('click', () => {
    const colors = ['#f97316','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'];
    onboardingCategories.push({ name: '', color: colors[onboardingCategories.length % colors.length], keywords: [], selected: true, isCustom: true });
    renderOnboardingList();
    document.querySelectorAll('.onboarding-name-input').at(-1)?.focus();
  });
}

function renderOnboardingList() {
  const list = document.getElementById('onboardingList');
  list.innerHTML = onboardingCategories.map((cat, i) => `
    <div class="onboarding-cat ${cat.selected ? 'active' : ''}" data-index="${i}">
      <div class="onboarding-toggle">${cat.selected ? CHECK_SVG : ''}</div>
      <span class="onboarding-dot" style="background:${cat.color}"></span>
      ${cat.isCustom
        ? `<input class="onboarding-name-input" data-index="${i}" value="${escapeHtml(cat.name)}" placeholder="Name">`
        : `<span class="onboarding-name">${escapeHtml(cat.name)}</span>`}
      <input class="onboarding-keywords" data-index="${i}" value="${cat.keywords.join(', ')}" placeholder="keywords">
      ${cat.isCustom ? `<button class="onboarding-remove" data-index="${i}">×</button>` : ''}
    </div>
  `).join('');

  list.querySelectorAll('.onboarding-cat').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('.onboarding-remove')) return;
      const i = parseInt(card.dataset.index);
      onboardingCategories[i].selected = !onboardingCategories[i].selected;
      card.classList.toggle('active', onboardingCategories[i].selected);
      card.querySelector('.onboarding-toggle').innerHTML = onboardingCategories[i].selected ? CHECK_SVG : '';
    });
  });
  list.querySelectorAll('.onboarding-keywords').forEach(inp => {
    inp.addEventListener('input', () => {
      onboardingCategories[parseInt(inp.dataset.index)].keywords = inp.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    });
    inp.addEventListener('click', e => e.stopPropagation());
  });
  list.querySelectorAll('.onboarding-name-input').forEach(inp => {
    inp.addEventListener('input', () => { onboardingCategories[parseInt(inp.dataset.index)].name = inp.value; });
    inp.addEventListener('click', e => e.stopPropagation());
  });
  list.querySelectorAll('.onboarding-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      onboardingCategories.splice(parseInt(btn.dataset.index), 1);
      renderOnboardingList();
    });
  });
}

async function completeOnboarding() {
  document.querySelectorAll('.onboarding-keywords').forEach(inp => {
    onboardingCategories[parseInt(inp.dataset.index)].keywords = inp.value.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  });
  document.querySelectorAll('.onboarding-name-input').forEach(inp => {
    onboardingCategories[parseInt(inp.dataset.index)].name = inp.value.trim();
  });
  for (const cat of onboardingCategories.filter(c => c.selected && c.name.trim())) {
    await send({ action: 'ADD_CATEGORY', data: { category: { name: cat.name, color: cat.color, keywords: cat.keywords } } });
  }
  await finishOnboarding();
}

async function skipOnboarding() { await finishOnboarding(); }

async function finishOnboarding() {
  await chrome.storage.local.set({ onboardingComplete: true });
  document.getElementById('onboarding').style.display = 'none';
  document.getElementById('app').style.display = '';
  attachListeners();
  await loadData();
  render();
}

// ── Listeners ────────────────────────────────────────────────
function attachListeners() {
  // Search
  document.getElementById('searchInput').addEventListener('input', handleSearch);
  document.getElementById('searchClear').addEventListener('click', clearSearch);

  // Sync button (in search row)
  document.getElementById('syncBtn').addEventListener('click', startSync);
  document.getElementById('stopSyncBtn').addEventListener('click', stopSync);
  document.getElementById('emptySyncBtn')?.addEventListener('click', startSync);

  // Tag + type filters
  document.getElementById('tagFilter').addEventListener('change', (e) => {
    state.tagFilter = e.target.value;
    renderBookmarks();
  });
  document.getElementById('typeFilter').addEventListener('change', (e) => {
    state.typeFilter = e.target.value;
    renderBookmarks();
  });

  // Footer
  document.getElementById('exportBtn').addEventListener('click', () => exportBookmarks('json'));
  document.getElementById('manageBtn').addEventListener('click', () => openPanel('manageOverlay'));

  // Settings
  document.getElementById('settingsBtn').addEventListener('click', () => openPanel('settingsOverlay'));
  document.getElementById('panelSyncBtn').addEventListener('click', () => { closeAllPanels(); startSync(); });
  document.getElementById('exportJson').addEventListener('click', () => { closeAllPanels(); exportBookmarks('json'); });
  document.getElementById('exportCsv').addEventListener('click', () => { closeAllPanels(); exportBookmarks('csv'); });

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', (e) => {
    const btn = e.target.closest('.theme-btn');
    if (!btn) return;
    const theme = btn.dataset.theme;
    applyTheme(theme);
    saveSettings({ theme });
  });

  // Accent presets
  document.getElementById('accentPresets').addEventListener('click', (e) => {
    const swatch = e.target.closest('.accent-swatch');
    if (!swatch) return;
    const color = swatch.dataset.color;
    applyAccent(color);
    saveSettings({ accent: color });
  });

  // Custom accent color picker
  document.getElementById('accentCustom').addEventListener('input', (e) => {
    applyAccent(e.target.value);
    saveSettings({ accent: e.target.value });
  });

  // Collections panel
  document.getElementById('addCategoryBtn').addEventListener('click', () => openCategoryModal());
  document.getElementById('recategorizeBtn').addEventListener('click', recategorizeAll);

  // Category modal
  document.getElementById('saveCategoryBtn').addEventListener('click', saveCategory);

  // Close buttons (panel + modal)
  document.querySelectorAll('[data-close-panel]').forEach(btn => {
    btn.addEventListener('click', () => closePanel(btn.dataset.closePanel));
  });
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
  });
  document.querySelectorAll('.panel-overlay').forEach(p => {
    p.addEventListener('click', e => { if (e.target === p) closePanel(p.id); });
  });

  // Color presets
  document.querySelectorAll('.color-preset').forEach(p => {
    p.addEventListener('click', e => {
      const color = e.currentTarget.dataset.color;
      const input = e.currentTarget.closest('.color-picker').querySelector('input[type="color"]');
      input.value = color;
      updateColorPresets(input);
    });
  });
  document.getElementById('categoryColor').addEventListener('input', e => updateColorPresets(e.target));
}

// ── Data ─────────────────────────────────────────────────────
async function loadData() {
  const [br, cr, tr] = await Promise.all([
    send({ action: 'GET_BOOKMARKS', data: {} }),
    send({ action: 'GET_CATEGORIES', data: {} }),
    send({ action: 'GET_TAGS', data: {} }),
  ]);
  state.bookmarks  = br.bookmarks  || [];
  state.categories = cr.categories || [];
  state.tags       = tr.tags       || [];
}

// ── Render ───────────────────────────────────────────────────
function render() {
  renderPills();
  renderTagFilter();
  renderBookmarks();
  renderCategoriesPanel();
  renderFooter();
}

function renderPills() {
  const row = document.getElementById('pillsRow');
  const pills = [
    `<button class="pill ${state.activeCategory === '' ? 'active' : ''}" data-category="">All</button>`,
    ...state.categories.map(c =>
      `<button class="pill ${state.activeCategory === c.id ? 'active' : ''}" data-category="${c.id}">${escapeHtml(c.name)}</button>`
    ),
    `<button class="pill ${state.activeCategory === 'uncategorized' ? 'active' : ''}" data-category="uncategorized">Uncategorized</button>`,
  ];
  row.innerHTML = pills.join('');
  row.querySelectorAll('.pill').forEach(p => {
    p.addEventListener('click', () => {
      state.activeCategory = p.dataset.category;
      renderPills();
      renderBookmarks();
    });
  });
}

function renderTagFilter() {
  const sel = document.getElementById('tagFilter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">All tags</option>' +
    state.tags.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
  sel.value = prev;
}

function getFilteredBookmarks() {
  let list = state.bookmarks;

  if (state.activeCategory === 'uncategorized') {
    list = list.filter(b => !b.categoryId);
  } else if (state.activeCategory) {
    list = list.filter(b => b.categoryId === state.activeCategory);
  }

  if (state.tagFilter) {
    list = list.filter(b => b.tagIds && b.tagIds.includes(state.tagFilter));
  }

  if (state.typeFilter) {
    list = list.filter(b => b.mediaType === state.typeFilter);
  }

  if (state.searchQuery) {
    const q = state.searchQuery.toLowerCase();
    list = list.filter(b =>
      (b.text && b.text.toLowerCase().includes(q)) ||
      (b.authorName && b.authorName.toLowerCase().includes(q)) ||
      (b.authorHandle && b.authorHandle.toLowerCase().includes(q)) ||
      (b.hashtags && b.hashtags.some(h => h.toLowerCase().includes(q)))
    );
  }
  return list;
}

function renderBookmarks() {
  const list = getFilteredBookmarks();
  const container = document.getElementById('bookmarksList');
  const empty = document.getElementById('emptyBookmarks');

  if (list.length === 0) {
    container.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  container.innerHTML = list.map(b => {
    const cat = state.categories.find(c => c.id === b.categoryId);
    const initials = getInitials(b.authorName);
    const avatarColor = stringToColor(b.authorHandle || b.authorName || '');
    const hashtags = (b.hashtags || []).slice(0, 4).map(h => `#${h}`).join(' ');

    const mediaIcon = { photo: '🖼', video: '▶', thread: '🧵', post: '' }[b.mediaType] || '';

    return `
      <div class="bookmark-item" data-id="${b.id}">
        <div class="bookmark-avatar" style="background:${avatarColor}">
          ${b.authorAvatar
            ? `<img src="${b.authorAvatar}" alt="${escapeHtml(b.authorName)}" onerror="this.parentElement.innerHTML='${initials}'">`
            : initials}
        </div>
        <div class="bookmark-body">
          <div class="bookmark-top">
            <div class="bookmark-author-wrap">
              <span class="bookmark-author">${escapeHtml(b.authorName)}</span>
              <span class="bookmark-handle">@${escapeHtml(b.authorHandle)}</span>
            </div>
            ${cat ? `<span class="bookmark-badge" style="color:${cat.color}">${escapeHtml(cat.name)}</span>` : ''}
          </div>
          <p class="bookmark-text">${escapeHtml(b.text)}</p>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            ${hashtags ? `<div class="bookmark-hashtags">${escapeHtml(hashtags)}</div>` : ''}
            ${mediaIcon ? `<span class="media-badge">${mediaIcon} ${b.mediaType}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.bookmark-item').forEach(item => {
    item.addEventListener('click', () => openBookmarkDetail(item.dataset.id));
  });
}

function renderCategoriesPanel() {
  const list = document.getElementById('categoriesList');
  if (!list) return;
  if (state.categories.length === 0) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-3);padding:8px 0">No collections yet</p>';
    return;
  }
  list.innerHTML = state.categories.map(cat => {
    const count = state.bookmarks.filter(b => b.categoryId === cat.id).length;
    const kwText = (cat.keywords || []).join(', ');
    return `
      <div class="category-item" data-id="${cat.id}">
        <div class="category-info" style="flex-direction:column;align-items:flex-start;gap:2px">
          <div style="display:flex;align-items:center;gap:8px">
            <div class="category-dot" style="background:${cat.color}"></div>
            <span class="category-name">${escapeHtml(cat.name)}</span>
            <span class="category-count">${count}</span>
          </div>
          ${kwText ? `<div class="category-keywords">${escapeHtml(kwText)}</div>` : ''}
        </div>
        <div class="category-actions">
          <button class="btn btn-sm btn-secondary edit-cat">Edit</button>
          <button class="btn btn-sm btn-danger del-cat">Del</button>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.category-item').forEach(item => {
    item.querySelector('.edit-cat').addEventListener('click', () => editCategory(item.dataset.id));
    item.querySelector('.del-cat').addEventListener('click', () => deleteCategory(item.dataset.id));
  });
}

function renderFooter() {
  const total = state.bookmarks.length;
  const cols  = state.categories.length;
  document.getElementById('footerStats').textContent =
    `${total} bookmark${total !== 1 ? 's' : ''} · ${cols} collection${cols !== 1 ? 's' : ''}`;
}

// ── Search ───────────────────────────────────────────────────
async function handleSearch(e) {
  state.searchQuery = e.target.value;
  document.getElementById('searchClear').style.display = state.searchQuery ? 'flex' : 'none';
  renderBookmarks();
}

function clearSearch() {
  state.searchQuery = '';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchClear').style.display = 'none';
  renderBookmarks();
}

// ── Sync ─────────────────────────────────────────────────────
async function startSync() {
  if (isSyncing) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }).catch(() => []);
  if (!tab?.url) { showToast('Could not access current tab', 'error'); return; }
  if (!tab.url.includes('x.com') && !tab.url.includes('twitter.com')) {
    showToast('Open x.com first, then sync', 'warning'); return;
  }
  try {
    await chrome.tabs.sendMessage(tab.id, { action: 'START_AUTO_SCROLL' });
  } catch (_) {
    showToast('Could not reach x.com — try refreshing it', 'error'); return;
  }
  isSyncing = true;
  setSyncOverlay(true);
  syncPollInterval = setInterval(async () => {
    const r = await chrome.storage.local.get('bookmarks');
    const count = (r.bookmarks || []).length;
    const el = document.getElementById('syncCount');
    if (el) el.textContent = `${count} bookmark${count !== 1 ? 's' : ''} captured so far`;
  }, 1000);
}

function stopSync() {
  clearInterval(syncPollInterval);
  isSyncing = false;
  setSyncOverlay(false);
  loadData().then(render);
}

function setSyncOverlay(visible) {
  document.getElementById('syncOverlay').classList.toggle('active', visible);
  const btn = document.getElementById('syncBtn');
  btn.disabled = visible;
  btn.classList.toggle('spinning', visible);
}

// ── Category CRUD ─────────────────────────────────────────────
function openCategoryModal(cat = null) {
  state.editingCategory = cat;
  document.getElementById('categoryModalTitle').textContent = cat ? 'Edit Collection' : 'Add Collection';
  document.getElementById('categoryName').value = cat ? cat.name : '';
  document.getElementById('categoryKeywords').value = cat ? (cat.keywords || []).join(', ') : '';
  const colorInput = document.getElementById('categoryColor');
  colorInput.value = cat ? cat.color : '#f97316';
  updateColorPresets(colorInput);
  openModal('categoryModal');
}

async function saveCategory() {
  const name = document.getElementById('categoryName').value.trim();
  const color = document.getElementById('categoryColor').value;
  const keywords = document.getElementById('categoryKeywords').value
    .split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  if (!name) { showToast('Enter a collection name', 'warning'); return; }

  if (state.editingCategory) {
    await send({ action: 'UPDATE_CATEGORY', data: { id: state.editingCategory.id, updates: { name, color, keywords } } });
    showToast('Collection updated', 'success');
  } else {
    await send({ action: 'ADD_CATEGORY', data: { category: { name, color, keywords } } });
    showToast('Collection created', 'success');
  }
  closeModal('categoryModal');
  await loadData();
  render();
}

function editCategory(id) {
  const cat = state.categories.find(c => c.id === id);
  if (cat) openCategoryModal(cat);
}

async function deleteCategory(id) {
  if (!confirm('Delete this collection?')) return;
  await send({ action: 'DELETE_CATEGORY', data: { id } });
  if (state.activeCategory === id) state.activeCategory = '';
  showToast('Collection deleted', 'success');
  await loadData();
  render();
}

async function recategorizeAll() {
  const r = await send({ action: 'RECATEGORIZE_BOOKMARKS', data: {} });
  await loadData();
  render();
  showToast(`Re-sorted — ${r.changed} bookmark${r.changed !== 1 ? 's' : ''} updated`, 'success');
}

// ── Bookmark detail ───────────────────────────────────────────
function openBookmarkDetail(id) {
  const b = state.bookmarks.find(x => x.id === id);
  if (!b) return;

  const avatarColor = stringToColor(b.authorHandle || b.authorName || '');
  const initials = getInitials(b.authorName);

  document.getElementById('bookmarkDetailContent').innerHTML = `
    <div class="detail-header">
      <div class="detail-avatar" style="background:${avatarColor}">
        ${b.authorAvatar
          ? `<img src="${b.authorAvatar}" alt="" onerror="this.parentElement.innerHTML='${initials}'">`
          : initials}
      </div>
      <div>
        <div class="detail-author">${escapeHtml(b.authorName)}</div>
        <div class="detail-handle">@${escapeHtml(b.authorHandle)}</div>
      </div>
    </div>
    <p class="detail-text">${escapeHtml(b.text)}</p>
    <div>
      <button class="detail-link" data-url="${b.tweetUrl}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        View on X
      </button>
    </div>
    <div class="detail-section">
      <h4>Collection</h4>
      <select class="filter-select" id="detailCategorySelect">
        <option value="">None</option>
        ${state.categories.map(c => `<option value="${c.id}" ${b.categoryId === c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
      </select>
    </div>
    ${(b.tagIds?.length > 0) ? `
    <div class="detail-section">
      <h4>Tags</h4>
      <div class="tag-chips">
        ${b.tagIds.map(tid => {
          const t = state.tags.find(x => x.id === tid);
          return t ? `<span class="tag-chip" style="background:${t.color}22;color:${t.color};border-color:${t.color}">${escapeHtml(t.name)}</span>` : '';
        }).join('')}
      </div>
    </div>` : ''}
  `;

  openModal('bookmarkDetailModal');

  document.querySelector('.detail-link[data-url]').addEventListener('click', (e) => {
    chrome.tabs.update({ url: e.currentTarget.dataset.url });
  });

  document.getElementById('detailCategorySelect').addEventListener('change', async function () {
    await send({ action: 'ASSIGN_CATEGORY', data: { bookmarkId: b.id, categoryId: this.value || null } });
    await loadData();
    render();
    openBookmarkDetail(b.id);
  });

}

// ── Export ────────────────────────────────────────────────────
async function exportBookmarks(format) {
  const r = await send({ action: 'EXPORT_BOOKMARKS', data: { format } });
  if (!r.success) { showToast('Export failed', 'error'); return; }
  const blob = new Blob([r.data], { type: format === 'json' ? 'application/json' : 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: r.filename });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast(`Exported as ${format.toUpperCase()}`, 'success');
}

// ── Panels & Modals ───────────────────────────────────────────
function openPanel(id)  { document.getElementById(id).classList.add('active'); }
function closePanel(id) { document.getElementById(id).classList.remove('active'); }
function closeAllPanels() {
  document.querySelectorAll('.panel-overlay').forEach(p => p.classList.remove('active'));
}
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── Color presets ─────────────────────────────────────────────
function updateColorPresets(input) {
  input.closest('.color-picker').querySelectorAll('.color-preset').forEach(p => {
    p.classList.toggle('active', p.dataset.color === input.value);
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = message;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ── Helpers ───────────────────────────────────────────────────
function send(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, r => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(r || {});
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function stringToColor(str) {
  const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#0ea5e9','#ef4444','#f97316'];
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}
