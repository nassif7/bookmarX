import { useState } from 'react';
import type { Bookmark, Category } from '../../types';

interface Props {
  categories: Category[];
  bookmarks: Bookmark[];
  onClose: () => void;
  onAdd: () => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string) => void;
  onRecategorize: () => void;
}

export default function CollectionsPanel({ categories, bookmarks, onClose, onAdd, onEdit, onDelete, onRecategorize }: Props) {
  const [pendingDelete, setPendingDelete] = useState<Category | null>(null);

  return (
    <div className="panel-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div className="panel-header">
          <span>Collections</span>
          <button className="icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="panel-body">
          <div className="panel-section">
            <div className="btn-row">
              <button className="btn btn-primary" onClick={onAdd}>+ New collection</button>
              <button className="btn btn-secondary" onClick={onRecategorize}>Re-sort all</button>
            </div>
          </div>
          <div>
            {categories.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>No collections yet</p>
            ) : categories.map(cat => {
              const count = bookmarks.filter(b => b.categoryId === cat.id).length;
              const kwText = (cat.keywords ?? []).join(', ');
              return (
                <div key={cat.id} className="category-item">
                  <div className="category-info" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="category-dot" style={{ background: cat.color }} />
                      <span className="category-name">{cat.name}</span>
                      <span className="category-count">{count}</span>
                    </div>
                    {kwText && <div className="category-keywords">{kwText}</div>}
                  </div>
                  <div className="category-actions">
                    <button className="btn btn-sm btn-secondary" onClick={() => onEdit(cat)}>Edit</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setPendingDelete(cat)}>Del</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {pendingDelete && (
        <div className="confirm-overlay" onClick={() => setPendingDelete(null)}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <p className="confirm-title">Delete "{pendingDelete.name}"?</p>
            <p className="confirm-sub">Bookmarks in this collection won't be deleted.</p>
            <div className="confirm-actions">
              <button className="btn btn-secondary" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => { onDelete(pendingDelete.id); setPendingDelete(null); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
