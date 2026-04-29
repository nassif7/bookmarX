import { useRef } from 'react';

const ACCENT_PRESETS = [
  { color: '#1d9bf0', label: 'Twitter Blue' },
  { color: '#f97316', label: 'Orange' },
  { color: '#6366f1', label: 'Indigo' },
  { color: '#8b5cf6', label: 'Violet' },
  { color: '#ec4899', label: 'Pink' },
  { color: '#10b981', label: 'Emerald' },
  { color: '#0ea5e9', label: 'Sky' },
  { color: '#ef4444', label: 'Red' },
];

interface Props {
  theme: string;
  accent: string;
  onClose: () => void;
  onTheme: (t: string) => void;
  onAccent: (c: string) => void;
  onSync: () => void;
  onExportJson: () => void;
  onExportCsv: () => void;
  onImport: (file: File) => void;
  onManage: () => void;
}

export default function SettingsPanel({ theme, accent, onClose, onTheme, onAccent, onSync, onExportJson, onExportCsv, onImport, onManage }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="panel-overlay active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="panel">
        <div className="panel-header">
          <span>Settings</span>
          <button className="icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="panel-body">
          <div className="panel-section">
            <p className="panel-label">Appearance</p>
            <div className="theme-toggle">
              {(['light', 'system', 'dark'] as const).map(t => (
                <button
                  key={t}
                  className={`theme-btn${theme === t ? ' active' : ''}`}
                  onClick={() => onTheme(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="panel-section">
            <p className="panel-label">Accent color</p>
            <div className="accent-presets">
              {ACCENT_PRESETS.map(p => (
                <button
                  key={p.color}
                  className={`accent-swatch${accent === p.color ? ' active' : ''}`}
                  style={{ background: p.color }}
                  title={p.label}
                  onClick={() => onAccent(p.color)}
                />
              ))}
              <div className="accent-custom-wrap">
                <input
                  type="color"
                  title="Custom color"
                  value={accent}
                  onChange={e => onAccent(e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="panel-section">
            <p className="panel-label">Sync bookmarks from X</p>
            <button className="btn btn-primary" onClick={onSync}>Sync now</button>
          </div>
          <div className="panel-section">
            <p className="panel-label">Collections</p>
            <button className="btn btn-secondary" onClick={onManage}>Manage collections</button>
          </div>
          <div className="panel-section">
            <p className="panel-label">Export data</p>
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={onExportJson}>JSON</button>
              <button className="btn btn-secondary" onClick={onExportCsv}>CSV</button>
            </div>
          </div>
          <div className="panel-section">
            <p className="panel-label">Import data</p>
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
            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
              Import JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
