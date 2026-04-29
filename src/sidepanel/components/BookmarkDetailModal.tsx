import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Bookmark, Category, Tag } from '../../types';
import { getInitials, stringToColor } from '../lib/utils';
import CategoryModal from './CategoryModal';

interface Props {
  bookmark: Bookmark;
  categories: Category[];
  tags: Tag[];
  onClose: () => void;
  onAssignCategory: (bookmarkId: string, categoryId: string | null) => void;
  onCreateCategory: (data: { name: string; color: string; keywords: string[] }) => Promise<Category>;
}

export default function BookmarkDetailModal({ bookmark: b, categories, tags, onClose, onAssignCategory, onCreateCategory }: Props) {
  const avatarColor = stringToColor(b.authorHandle || b.authorName || '');
  const initials = getInitials(b.authorName);
  const bookmarkTags = (b.tagIds ?? [])
    .map(tid => tags.find(t => t.id === tid))
    .filter((t): t is Tag => !!t);

  const [search, setSearch] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (dropdownOpen) setTimeout(() => searchRef.current?.focus(), 10);
  }, [dropdownOpen]);

  const currentCategory = categories.find(c => c.id === b.categoryId);
  const filtered = categories.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleSelect = (categoryId: string | null) => {
    if (categoryId === (b.categoryId ?? null)) {
      setDropdownOpen(false);
      setSearch('');
      return;
    }
    const label = categoryId ? (categories.find(c => c.id === categoryId)?.name ?? 'this collection') : 'None';
    if (!confirm(`Move to "${label}"?`)) return;
    setDropdownOpen(false);
    setSearch('');
    onAssignCategory(b.id, categoryId);
  };

  const handleAddNew = async (data: { name: string; color: string; keywords: string[] }) => {
    const newCat = await onCreateCategory(data);
    setShowAddModal(false);
    await onAssignCategory(b.id, newCat.id);
  };

  return (
    <>
      <div className="modal active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="modal-content">
          <div className="modal-header">
            <h3>Bookmark</h3>
            <button className="icon-btn" onClick={onClose}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <div className="detail-header">
              <div className="detail-avatar" style={{ background: avatarColor }}>
                {b.authorAvatar ? (
                  <img src={b.authorAvatar} alt="" onError={e => { (e.currentTarget.parentElement!).textContent = initials; }} />
                ) : initials}
              </div>
              <div>
                <div className="detail-author">{b.authorName}</div>
                <div className="detail-handle">@{b.authorHandle}</div>
              </div>
            </div>
            <p className="detail-text">{b.text}</p>
            <div>
              <button className="detail-link" onClick={() => chrome.tabs.update({ url: b.tweetUrl })}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                View on X
              </button>
            </div>

            <div className="detail-section">
              <h4>Collection</h4>
              <div className="collection-picker" ref={dropdownRef}>
                <button
                  className={`collection-trigger${dropdownOpen ? ' open' : ''}`}
                  onClick={() => setDropdownOpen(o => !o)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {currentCategory && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: currentCategory.color, display: 'inline-block', flexShrink: 0 }} />
                    )}
                    {currentCategory?.name ?? 'None'}
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                    <polyline points={dropdownOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div className="collection-dropdown">
                    <input
                      ref={searchRef}
                      className="collection-search"
                      placeholder="Search collections…"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />
                    <div className="collection-options">
                      <div
                        className={`collection-option${!b.categoryId ? ' selected' : ''}`}
                        onClick={() => handleSelect(null)}
                      >
                        None
                      </div>
                      {filtered.map(c => (
                        <div
                          key={c.id}
                          className={`collection-option${b.categoryId === c.id ? ' selected' : ''}`}
                          onClick={() => handleSelect(c.id)}
                        >
                          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                          {c.name}
                        </div>
                      ))}
                      <div
                        className="collection-option add-new"
                        onClick={() => { setDropdownOpen(false); setSearch(''); setShowAddModal(true); }}
                      >
                        + New collection
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {bookmarkTags.length > 0 && (
              <div className="detail-section">
                <h4>Tags</h4>
                <div className="tag-chips">
                  {bookmarkTags.map(t => (
                    <span
                      key={t.id}
                      className="tag-chip"
                      style={{ background: `${t.color}22`, color: t.color, borderColor: t.color }}
                    >
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddModal && createPortal(
        <CategoryModal
          category={null}
          onClose={() => setShowAddModal(false)}
          onSave={handleAddNew}
        />,
        document.body
      )}
    </>
  );
}
