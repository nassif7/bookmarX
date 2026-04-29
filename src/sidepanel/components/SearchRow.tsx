interface Props {
  query: string;
  onSearch: (q: string) => void;
  onSync: () => void;
  isSyncing: boolean;
}

export default function SearchRow({ query, onSearch, onSync, isSyncing }: Props) {
  return (
    <div className="search-row">
      <div className="search-wrap">
        <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          className="search-input"
          placeholder="Search your bookmarks..."
          autoComplete="off"
          value={query}
          onChange={e => onSearch(e.target.value)}
        />
        {query && (
          <button className="search-clear" onClick={() => onSearch('')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>
      <button
        className={`filter-btn${isSyncing ? ' spinning' : ''}`}
        disabled={isSyncing}
        onClick={onSync}
        title="Sync bookmarks"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="23 4 23 10 17 10" />
          <polyline points="1 20 1 14 7 14" />
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
        </svg>
      </button>
    </div>
  );
}
