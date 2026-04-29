import type { Tag } from '../../types';

interface Props {
  tags: Tag[];
  tagFilter: string;
  typeFilter: string;
  onTagFilter: (id: string) => void;
  onTypeFilter: (type: string) => void;
}

export default function FiltersRow({ tags, tagFilter, typeFilter, onTagFilter, onTypeFilter }: Props) {
  return (
    <div className="filters-row">
      <select
        className="filter-select"
        value={tagFilter}
        onChange={e => onTagFilter(e.target.value)}
      >
        <option value="">All tags</option>
        {tags.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <select
        className="filter-select"
        value={typeFilter}
        onChange={e => onTypeFilter(e.target.value)}
      >
        <option value="">All types</option>
        <option value="photo">Photo</option>
        <option value="video">Video</option>
        <option value="thread">Thread</option>
        <option value="post">Post</option>
      </select>
    </div>
  );
}
