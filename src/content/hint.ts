const HINT_ID = 'bookmarx-hint';

function createHint() {
  if (document.getElementById(HINT_ID)) return;

  const hintDiv = document.createElement('div');
  hintDiv.id = HINT_ID;
  hintDiv.textContent = 'Hint: Use bookmarX to save bookmarks!';
  hintDiv.style.position = 'fixed';
  hintDiv.style.top = '10px';
  hintDiv.style.right = '10px';
  hintDiv.style.backgroundColor = 'rgba(255, 255, 0, 0.9)';
  hintDiv.style.padding = '8px 12px';
  hintDiv.style.borderRadius = '8px';
  hintDiv.style.zIndex = '10000';
  hintDiv.style.fontSize = '12px';
  hintDiv.style.color = '#000';
  hintDiv.style.cursor = 'pointer';
  hintDiv.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  hintDiv.onclick = () => hintDiv.remove();
  document.body.appendChild(hintDiv);
}

function removeHint() {
  const existing = document.getElementById(HINT_ID);
  if (existing && existing.parentElement) existing.parentElement.removeChild(existing);
}

function handleRouteChange() {
  if (window.location.pathname.startsWith('/i/bookmarks')) {
    createHint();
  } else {
    removeHint();
  }
}

function patchHistoryMethod(method: 'pushState' | 'replaceState') {
  const original = history[method];
  return function (this: History, ...args: any[]) {
    const result = original.apply(this, args);
    window.dispatchEvent(new Event(method));
    window.dispatchEvent(new Event('locationchange'));
    return result;
  } as typeof original;
}

history.pushState = patchHistoryMethod('pushState');
history.replaceState = patchHistoryMethod('replaceState');
window.addEventListener('popstate', handleRouteChange);
window.addEventListener('locationchange', handleRouteChange);

let lastPath = window.location.pathname;
setInterval(() => {
  if (window.location.pathname !== lastPath) {
    lastPath = window.location.pathname;
    handleRouteChange();
  }
}, 500);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', handleRouteChange);
} else {
  handleRouteChange();
}
