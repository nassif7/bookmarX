import { useState, useEffect } from 'react';
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
  const [keywords, setKeywords] = useState('');

  useEffect(() => {
    setName(category?.name ?? '');
    setColor(category?.color ?? '#f97316');
    setKeywords((category?.keywords ?? []).join(', '));
  }, [category]);

  const handleSave = () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    const kws = keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    onSave({ name: trimmedName, color, keywords: kws });
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
            <label>Keywords <span className="label-hint">(comma-separated)</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. ai, javascript, react"
              value={keywords}
              onChange={e => setKeywords(e.target.value)}
            />
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
