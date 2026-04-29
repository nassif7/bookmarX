(function () {
  'use strict';

  let autoScrollActive = false;
  let stopEarly = false;
  let consecutiveZeroAdds = 0;

  function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function clickBookmarksLink(): boolean {
    const link = document.querySelector<HTMLAnchorElement>('a[href="/i/bookmarks"]');
    if (link) { link.click(); return true; }
    return false;
  }

  async function waitForBookmarksPage(maxMs = 6000): Promise<boolean> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (window.location.pathname.startsWith('/i/bookmarks')) return true;
      await sleep(300);
    }
    return false;
  }

  async function waitForContent(maxMs = 8000): Promise<boolean> {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (document.querySelector('[data-testid="tweet"]')) return true;
      await sleep(300);
    }
    return false;
  }

  async function performScroll(): Promise<void> {
    let unchangedRuns = 0;
    let lastHeight = document.documentElement.scrollHeight;
    stopEarly = false;
    consecutiveZeroAdds = 0;

    while (unchangedRuns < 4 && !stopEarly) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1800);
      const newHeight = document.documentElement.scrollHeight;
      if (newHeight === lastHeight) { unchangedRuns++; }
      else { unchangedRuns = 0; lastHeight = newHeight; }
      chrome.runtime.sendMessage({ action: 'SCROLL_PROGRESS', data: {} }).catch(() => {});
    }

    chrome.runtime.sendMessage({ action: 'SCROLL_COMPLETE', data: { stoppedEarly: stopEarly } }).catch(() => {});
  }

  async function startAutoScroll(): Promise<void> {
    if (autoScrollActive) return;

    if (!window.location.pathname.startsWith('/i/bookmarks')) {
      const clicked = clickBookmarksLink();
      if (!clicked) {
        await chrome.storage.local.set({ pendingAutoScroll: true });
        window.location.href = 'https://x.com/i/bookmarks';
        return;
      }
      const arrived = await waitForBookmarksPage();
      if (!arrived) {
        chrome.runtime.sendMessage({ action: 'SCROLL_COMPLETE', data: {} }).catch(() => {});
        return;
      }
    }

    await waitForContent();
    await sleep(500);
    autoScrollActive = true;
    await performScroll();
    autoScrollActive = false;
  }

  // Resume after hard navigation
  (async () => {
    if (window.location.pathname.startsWith('/i/bookmarks')) {
      const result = await chrome.storage.local.get('pendingAutoScroll');
      if (result.pendingAutoScroll) {
        await chrome.storage.local.remove('pendingAutoScroll');
        await waitForContent();
        await sleep(500);
        autoScrollActive = true;
        await performScroll();
        autoScrollActive = false;
      }
    }
  })();

  // Bridge: main-world postMessage → background
  window.addEventListener('message', async (event: MessageEvent) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'bookmarx-injected') return;

    const { action, bookmarks } = event.data as { action: string; bookmarks?: unknown[] };
    if (action === 'BOOKMARKS_CAPTURED' && bookmarks && bookmarks.length > 0) {
      try {
        const result = await chrome.runtime.sendMessage({ action: 'BOOKMARKS_CAPTURED', data: { bookmarks } }) as { added?: number };
        if (result?.added === 0) {
          consecutiveZeroAdds++;
          if (consecutiveZeroAdds >= 2) stopEarly = true;
        } else {
          consecutiveZeroAdds = 0;
        }
      } catch (_) {}
    }
  });

  chrome.runtime.onMessage.addListener((message: { action: string }, _sender, sendResponse) => {
    if (message.action === 'START_AUTO_SCROLL') {
      startAutoScroll();
      sendResponse({ success: true });
    }
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        isX: window.location.hostname.includes('x.com') || window.location.hostname.includes('twitter.com'),
      });
    }
    return true;
  });
})();
