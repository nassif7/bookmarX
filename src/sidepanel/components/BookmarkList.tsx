import type { Bookmark, Category } from '../../types';
import BookmarkCard from './BookmarkCard';

interface Props {
  bookmarks: Bookmark[];
  categories: Category[];
  onBookmarkClick: (id: string) => void;
}

export default function BookmarkList({ bookmarks, categories, onBookmarkClick }: Props) {
  return (
    <main className="content">
      {bookmarks.map(b => (
        <BookmarkCard
          key={b.id}
          bookmark={b}
          category={categories.find(c => c.id === b.categoryId)}
          onClick={() => onBookmarkClick(b.id)}
        />
      ))}
    </main>
  );
}
