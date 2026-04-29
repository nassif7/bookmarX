import type { Bookmark, Category } from '../../types';

interface Props {
  categories: Category[];
  bookmarks: Bookmark[];
  activeCategory: string;
  onChange: (id: string) => void;
}

export default function PillsRow({ categories, bookmarks, activeCategory, onChange }: Props) {
  const countFor = (id: string) => bookmarks.filter(b => b.categoryId === id).length;
  const uncategorizedCount = bookmarks.filter(b => !b.categoryId).length;

  return (
    <div className="pills-row">
      <button
        className={`pill${activeCategory === '' ? ' active' : ''}`}
        onClick={() => onChange('')}
      >
        All <span className="pill-count">{bookmarks.length}</span>
      </button>
      {categories.map(c => (
        <button
          key={c.id}
          className={`pill${activeCategory === c.id ? ' active' : ''}`}
          onClick={() => onChange(c.id)}
        >
          {c.name} <span className="pill-count">{countFor(c.id)}</span>
        </button>
      ))}
      <button
        className={`pill${activeCategory === 'uncategorized' ? ' active' : ''}`}
        onClick={() => onChange('uncategorized')}
      >
        Uncategorized <span className="pill-count">{uncategorizedCount}</span>
      </button>
    </div>
  );
}
