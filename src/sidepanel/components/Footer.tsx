import { useRef } from 'react';

interface Props {
  bookmarkCount: number;
  categoryCount: number;
  lastSynced: Date | null;
  onExport: () => void;
  onImport: (file: File) => void;
  onManage: () => void;
}

function formatSynced(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'synced just now';
  if (mins < 60) return `synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `synced ${hrs}h ago`;
}

export default function Footer({ bookmarkCount, categoryCount, lastSynced, onExport, onImport, onManage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <footer className="footer">
      <span className="footer-stats">
        {bookmarkCount} bookmark{bookmarkCount !== 1 ? 's' : ''} · {categoryCount} collection{categoryCount !== 1 ? 's' : ''}
        {lastSynced && <span className="footer-synced"> · {formatSynced(lastSynced)}</span>}
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) { onImport(file); e.target.value = ''; }
          }}
        />
        <button className="footer-btn" onClick={() => fileInputRef.current?.click()} title="Import">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          import
        </button>
        <button className="footer-btn footer-btn-primary" onClick={onManage}>
          collections
        </button>
      </div>
    </footer>
  );
}
