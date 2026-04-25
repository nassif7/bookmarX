(function () {
  'use strict';

  let autoScrollActive = false;

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Try to click X's sidebar Bookmarks link for SPA navigation (no page reload)
  function clickBookmarksLink() {
    const link = document.querySelector('a[href="/i/bookmarks"]');
    if (link) { link.click(); return true; }
    return false;
  }

  // Poll until URL contains /i/bookmarks (SPA navigation may take a moment)
  async function waitForBookmarksPage(maxMs = 6000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (window.location.pathname.startsWith('/i/bookmarks')) return true;
      await sleep(300);
    }
    return false;
  }

  // Wait until at least one tweet is rendered on the bookmarks page
  async function waitForContent(maxMs = 8000) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (document.querySelector('[data-testid="tweet"]')) return true;
      await sleep(300);
    }
    return false;
  }

  async function performScroll() {
    let unchangedRuns = 0;
    let lastHeight = document.documentElement.scrollHeight;

    while (unchangedRuns < 4) {
      window.scrollTo(0, document.documentElement.scrollHeight);
      await sleep(1800);

      const newHeight = document.documentElement.scrollHeight;
      if (newHeight === lastHeight) {
        unchangedRuns++;
      } else {
        unchangedRuns = 0;
        lastHeight = newHeight;
      }

      chrome.runtime.sendMessage({ action: 'SCROLL_PROGRESS', data: {} }).catch(() => {});
    }

    chrome.runtime.sendMessage({ action: 'SCROLL_COMPLETE', data: {} }).catch(() => {});
  }

  async function startAutoScroll() {
    if (autoScrollActive) return;

    // If not on the bookmarks page, navigate there first
    if (!window.location.pathname.startsWith('/i/bookmarks')) {
      const clicked = clickBookmarksLink();
      if (!clicked) {
        // Fallback: hard navigation; page will reload and pendingAutoScroll flag resumes the job
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

    // Wait for tweets to appear before starting scroll
    await waitForContent();
    await sleep(500);

    autoScrollActive = true;
    await performScroll();
    autoScrollActive = false;
  }

  // After a hard navigation via the fallback path above, resume scroll automatically
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
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== 'bookmarkd-injected') return;

    const { action, bookmarks } = event.data;
    if (action === 'BOOKMARKS_CAPTURED' && bookmarks?.length > 0) {
      chrome.runtime.sendMessage({ action: 'BOOKMARKS_CAPTURED', data: { bookmarks } })
        .catch(() => {});
    }
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.action === 'START_AUTO_SCROLL') {
      startAutoScroll();
      sendResponse({ success: true });
    }
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        isX:
          window.location.hostname.includes('x.com') ||
          window.location.hostname.includes('twitter.com'),
      });
    }
    return true;
  });
})();
