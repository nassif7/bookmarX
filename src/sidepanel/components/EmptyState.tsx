interface Props {
  onSync: () => void;
}

export default function EmptyState({ onSync }: Props) {
  return (
    <div className="empty-state">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
      <p>No bookmarks yet</p>
      <button className="btn btn-primary" onClick={onSync}>Sync from X</button>
    </div>
  );
}
