interface Props {
  count: number;
  onStop: () => void;
}

export default function SyncOverlay({ count, onStop }: Props) {
  return (
    <div className="sync-overlay active">
      <div className="sync-card">
        <div className="sync-card-top">
          <div className="sync-spinner-lg" />
          <div className="sync-card-text">
            <span className="sync-card-title">Syncing bookmarks</span>
            <span className="sync-card-count">
              {count > 0 ? `${count} bookmark${count !== 1 ? 's' : ''} captured so far` : 'Starting…'}
            </span>
          </div>
          <button className="sync-stop-btn" onClick={onStop}>Stop</button>
        </div>
        <div className="sync-hints">
          <div className="sync-hint">
            <span className="sync-hint-num">1</span>
            Make sure you are on <strong>x.com/i/bookmarks</strong>
          </div>
          <div className="sync-hint">
            <span className="sync-hint-num">2</span>
            If nothing is captured after a few seconds, <strong>refresh x.com</strong> and try again
          </div>
          <div className="sync-hint">
            <span className="sync-hint-num">3</span>
            Sync stops automatically once it reaches already-saved bookmarks
          </div>
        </div>
      </div>
    </div>
  );
}
