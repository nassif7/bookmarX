import { useState } from 'react';

const SUGGESTED_CATEGORIES = [
  { name: 'Tech',     color: '#6366f1', keywords: ['javascript','typescript','python','react','nodejs','github','coding','programming','developer','software'] },
  { name: 'AI & ML',  color: '#8b5cf6', keywords: ['ai','gpt','llm','openai','claude','chatgpt','machine learning','neural','gemini','deepmind'] },
  { name: 'Design',   color: '#ec4899', keywords: ['design','ux','ui','figma','css','typography','branding','animation','interface'] },
  { name: 'Business', color: '#f59e0b', keywords: ['startup','founder','entrepreneurship','saas','product','growth','revenue','b2b','marketing'] },
  { name: 'Finance',  color: '#10b981', keywords: ['crypto','bitcoin','stocks','investing','trading','finance','web3','defi','eth'] },
  { name: 'Science',  color: '#0ea5e9', keywords: ['research','science','biology','physics','chemistry','study','paper','space','climate'] },
  { name: 'Health',   color: '#ef4444', keywords: ['fitness','nutrition','health','workout','wellness','mindfulness','diet','sleep'] },
  { name: 'News',     color: '#6b7280', keywords: ['politics','economy','election','news','breaking','government','policy'] },
];

interface OnboardingCat {
  name: string;
  color: string;
  keywords: string[];
  selected: boolean;
  isCustom: boolean;
}

interface Props {
  onComplete: (categories: Array<{ name: string; color: string; keywords: string[] }>) => void;
  onSkip: () => void;
}

const COLORS = ['#f97316','#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6'];

export default function Onboarding({ onComplete, onSkip }: Props) {
  const [cats, setCats] = useState<OnboardingCat[]>(
    SUGGESTED_CATEGORIES.map(c => ({ ...c, keywords: [...c.keywords], selected: true, isCustom: false }))
  );

  const toggle = (i: number) => {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, selected: !c.selected } : c));
  };

  const updateKeywords = (i: number, val: string) => {
    setCats(prev => prev.map((c, idx) => idx === i
      ? { ...c, keywords: val.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) }
      : c
    ));
  };

  const updateName = (i: number, val: string) => {
    setCats(prev => prev.map((c, idx) => idx === i ? { ...c, name: val } : c));
  };

  const addCustom = () => {
    setCats(prev => [...prev, {
      name: '', color: COLORS[prev.length % COLORS.length],
      keywords: [], selected: true, isCustom: true,
    }]);
  };

  const remove = (i: number) => {
    setCats(prev => prev.filter((_, idx) => idx !== i));
  };

  const handleDone = () => {
    const selected = cats.filter(c => c.selected && c.name.trim());
    onComplete(selected.map(({ name, color, keywords }) => ({ name: name.trim(), color, keywords })));
  };

  return (
    <div id="onboarding" style={{ display: 'flex' }}>
      <div className="onboarding-header">
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" fill="currentColor" />
          </svg>
          <span>bookmarX</span>
        </div>
        <h2>Set up your collections</h2>
        <p>Auto-sort your tweets as you sync. Toggle the ones you want and edit their keywords.</p>
      </div>
      <div className="onboarding-list">
        {cats.map((cat, i) => (
          <div
            key={i}
            className={`onboarding-cat${cat.selected ? ' active' : ''}`}
            onClick={e => {
              const t = e.target as HTMLElement;
              if (t.tagName === 'INPUT' || t.closest('.onboarding-remove')) return;
              toggle(i);
            }}
          >
            <div className="onboarding-toggle">
              {cat.selected && (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <span className="onboarding-dot" style={{ background: cat.color }} />
            {cat.isCustom ? (
              <input
                className="onboarding-name-input"
                value={cat.name}
                placeholder="Name"
                onClick={e => e.stopPropagation()}
                onChange={e => updateName(i, e.target.value)}
              />
            ) : (
              <span className="onboarding-name">{cat.name}</span>
            )}
            <input
              className="onboarding-keywords"
              value={cat.keywords.join(', ')}
              placeholder="keywords"
              onClick={e => e.stopPropagation()}
              onChange={e => updateKeywords(i, e.target.value)}
            />
            {cat.isCustom && (
              <button
                className="onboarding-remove"
                onClick={e => { e.stopPropagation(); remove(i); }}
              >×</button>
            )}
          </div>
        ))}
      </div>
      <button className="onboarding-add-btn" onClick={addCustom}>+ Add custom collection</button>
      <div className="onboarding-footer">
        <button className="btn btn-secondary" onClick={onSkip}>Skip for now</button>
        <button className="btn btn-primary" onClick={handleDone}>Save &amp; Start</button>
      </div>
    </div>
  );
}
