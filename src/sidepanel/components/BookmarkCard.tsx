import type { Bookmark, Category } from '../../types';
import { getInitials, stringToColor } from '../lib/utils';

interface Props {
  bookmark: Bookmark;
  category?: Category;
  onClick: () => void;
}

const MEDIA_ICON: Record<string, string> = { photo: '🖼', video: '▶', thread: '🧵' };

export default function BookmarkCard({ bookmark: b, category, onClick }: Props) {
  const avatarColor = stringToColor(b.authorHandle || b.authorName || '');
  const initials = getInitials(b.authorName);
  const hashtags = (b.hashtags ?? []).slice(0, 4).map(h => `#${h}`).join(' ');
  const mediaIcon = MEDIA_ICON[b.mediaType] ?? '';

  return (
    <div className="bookmark-item" onClick={onClick}>
      <div className="bookmark-avatar" style={{ background: avatarColor }}>
        {b.authorAvatar ? (
          <img
            src={b.authorAvatar}
            alt={b.authorName}
            onError={e => { (e.currentTarget.parentElement!).textContent = initials; }}
          />
        ) : initials}
      </div>
      <div className="bookmark-body">
        <div className="bookmark-top">
          <div className="bookmark-author-wrap">
            <span className="bookmark-author">{b.authorName}</span>
            <span className="bookmark-handle">@{b.authorHandle}</span>
          </div>
          {category && (
            <span className="bookmark-badge" style={{ color: category.color }}>{category.name}</span>
          )}
        </div>
        <p className="bookmark-text">{b.text}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {hashtags && <div className="bookmark-hashtags">{hashtags}</div>}
          {mediaIcon && <span className="media-badge">{mediaIcon} {b.mediaType}</span>}
        </div>
      </div>
    </div>
  );
}
