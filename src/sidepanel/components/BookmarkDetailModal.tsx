import type { Bookmark, Category, Tag } from '../../types';
import { getInitials, stringToColor } from '../lib/utils';

interface Props {
  bookmark: Bookmark;
  categories: Category[];
  tags: Tag[];
  onClose: () => void;
  onAssignCategory: (bookmarkId: string, categoryId: string | null) => void;
}

export default function BookmarkDetailModal({ bookmark: b, categories, tags, onClose, onAssignCategory }: Props) {
  const avatarColor = stringToColor(b.authorHandle || b.authorName || '');
  const initials = getInitials(b.authorName);
  const bookmarkTags = (b.tagIds ?? [])
    .map(tid => tags.find(t => t.id === tid))
    .filter((t): t is Tag => !!t);

  return (
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
            <button
              className="detail-link"
              onClick={() => chrome.tabs.update({ url: b.tweetUrl })}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              View on X
            </button>
          </div>
          <div className="detail-section">
            <h4>Collection</h4>
            <select
              className="filter-select"
              value={b.categoryId ?? ''}
              onChange={e => onAssignCategory(b.id, e.target.value || null)}
            >
              <option value="">None</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
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
  );
}
