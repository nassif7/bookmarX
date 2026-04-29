interface Props {
  bookmarkCount: number;
  categoryCount: number;
  onExport: () => void;
  onManage: () => void;
}

export default function Footer({ bookmarkCount, categoryCount, onExport, onManage }: Props) {
  return (
    <footer className="footer">
      <span className="footer-stats">
        {bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''} · {categoryCount} collection{categoryCount !== 1 ? 's' : ''}
      </span>
      <div className="footer-actions">
        <button className="footer-btn" onClick={onExport} title="Export">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          export
        </button>
        <button className="footer-btn footer-btn-primary" onClick={onManage}>
          collections
        </button>
      </div>
    </footer>
  );
}
