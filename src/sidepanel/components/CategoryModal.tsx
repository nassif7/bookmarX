import { useEffect, useRef, useState } from 'react';
import type { Category } from '../../types';

const COLOR_PRESETS = ['#f97316', '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

interface Props {
  category: Category | null;
  onClose: () => void;
  onSave: (data: { name: string; color: string; keywords: string[] }) => void;
}

export default function CategoryModal({ category, onClose, onSave }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#f97316');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [kwInput, setKwInput] = useState('');
  const kwInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(category?.name ?? '');
    setColor(category?.color ?? '#f97316');
    setKeywords(category?.keywords ?? []);
    setKwInput('');
  }, [category]);

  const commitInput = (val: string) => {
    const kw = val.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
    }
    setKwInput('');
  };

  const handleKwChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val.includes(',')) {
      const parts = val.split(',');
      // everything before the last comma becomes chips
      parts.slice(0, -1).forEach(p => {
        const kw = p.trim().toLowerCase();
        if (kw) setKeywords(prev => prev.includes(kw) ? prev : [...prev, kw]);
      });
      setKwInput(parts[parts.length - 1].trimStart());
    } else {
      setKwInput(val);
    }
  };

  const handleKwKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitInput(kwInput);
    } else if (e.key === 'Backspace' && !kwInput) {
      setKeywords(prev => prev.slice(0, -1));
    }
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
    kwInputRef.current?.focus();
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    // Include any partially typed keyword
    const all = kwInput.trim()
      ? [...keywords, kwInput.trim().toLowerCase()].filter((k, i, a) => a.indexOf(k) === i)
      : keywords;
    onSave({ name: trimmedName, color, keywords: all });
  };

  return (
    <div className="modal active" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{category ? 'Edit Collection' : 'Add Collection'}</h3>
          <button className="icon-btn" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Collection name"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>Keywords <span className="label-hint">(comma or Enter to add)</span></label>
            <div
              className="kw-input-wrap"
              onClick={() => kwInputRef.current?.focus()}
            >
              {keywords.map(kw => (
                <span key={kw} className="kw-chip">
                  {kw}
                  <button
                    className="kw-chip-remove"
                    onClick={e => { e.stopPropagation(); removeKeyword(kw); }}
                    tabIndex={-1}
                  >×</button>
                </span>
              ))}
              <input
                ref={kwInputRef}
                className="kw-chip-input"
                placeholder={keywords.length === 0 ? 'e.g. ai, javascript, react' : ''}
                value={kwInput}
                onChange={handleKwChange}
                onKeyDown={handleKwKeyDown}
                onBlur={() => commitInput(kwInput)}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Color</label>
            <div className="color-picker">
              <input
                type="color"
                value={color}
                onChange={e => setColor(e.target.value)}
              />
              <div className="color-presets">
                {COLOR_PRESETS.map(c => (
                  <button
                    key={c}
                    className={`color-preset${color === c ? ' active' : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
