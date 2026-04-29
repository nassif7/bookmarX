import type { Bookmark, Category } from '../../types';

interface Props {
  categories: Category[];
  bookmarks: Bookmark[];
  activeCategory: string;
  onChange: (id: string) => void;
}

export default function PillsRow({ categories, activeCategory, onChange }: Props) {
  return (
    <div className="pills-row">
      <button
        className={`pill${activeCategory === '' ? ' active' : ''}`}
        onClick={() => onChange('')}
      >
        All
      </button>
      {categories.map(c => (
        <button
          key={c.id}
          className={`pill${activeCategory === c.id ? ' active' : ''}`}
          onClick={() => onChange(c.id)}
        >
          {c.name}
        </button>
      ))}
      <button
        className={`pill${activeCategory === 'uncategorized' ? ' active' : ''}`}
        onClick={() => onChange('uncategorized')}
      >
        Uncategorized
      </button>
    </div>
  );
}
