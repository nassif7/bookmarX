// Runs in the MAIN world — same JS context as X's own code.
// Intercepts fetch to capture bookmark API responses, then
// forwards to content.js (isolated world) via postMessage.
(function () {
  'use strict';

  function isBookmarkEndpoint(url) {
    return (
      url.includes('x.com') || url.includes('twitter.com') || url.startsWith('/')
    ) && /Bookmark/.test(url);
  }

  // X's GraphQL bookmark response can take several shapes depending on
  // the API version. Walk all known paths.
  function extractInstructions(data) {
    return (
      data?.data?.bookmark_timeline_v2?.timeline?.instructions ||
      data?.data?.bookmark_timeline?.timeline?.instructions ||
      data?.data?.bookmarks?.timeline?.instructions ||
      data?.data?.bookmarkDetails?.timeline?.instructions ||
      []
    );
  }

  function parseTweet(tweetResult) {
    if (!tweetResult) return null;

    // TweetWithVisibilityResults wraps the actual tweet
    const tweet =
      tweetResult.__typename === 'TweetWithVisibilityResults'
        ? tweetResult.tweet
        : tweetResult;

    if (!tweet || tweet.__typename !== 'Tweet') return null;

    const tweetId = tweet.rest_id;
    if (!tweetId) return null;

    const userResult = tweet.core?.user_results?.result;
    const userCore = userResult?.core || {};
    const userLegacy = userResult?.legacy || {};
    const tweetLegacy = tweet.legacy || {};

    const mediaItems = [
      ...(tweetLegacy.extended_entities?.media || []),
      ...(tweetLegacy.entities?.media || []),
    ];
    // Deduplicate by url
    const seenMedia = new Set();
    const media = [];
    for (const m of mediaItems) {
      const key = m.media_url_https || m.url;
      if (!seenMedia.has(key)) {
        seenMedia.add(key);
        media.push({ type: m.type, url: m.media_url_https || m.url });
      }
    }

    const authorHandle = userCore.screen_name || userLegacy.screen_name || '';

    // Determine media type
    let mediaType = 'post';
    if (media.some(m => m.type === 'video' || m.type === 'animated_gif')) {
      mediaType = 'video';
    } else if (media.some(m => m.type === 'photo')) {
      mediaType = 'photo';
    } else if (
      tweetLegacy.in_reply_to_screen_name &&
      authorHandle &&
      tweetLegacy.in_reply_to_screen_name.toLowerCase() === authorHandle.toLowerCase()
    ) {
      mediaType = 'thread';
    }

    return {
      id: tweetId,
      text: tweetLegacy.full_text || '',
      authorName: userCore.name || userLegacy.name || '',
      authorHandle,
      authorAvatar: userResult?.avatar?.image_url || userLegacy.profile_image_url_https || '',
      tweetUrl: `https://x.com/${authorHandle}/status/${tweetId}`,
      dateBookmarked: new Date().toISOString(),
      media,
      mediaType,
      hashtags: tweetLegacy.entities?.hashtags?.map((h) => h.text) || [],
      mentions: tweetLegacy.entities?.user_mentions?.map((m) => m.screen_name) || [],
      createdAt: tweetLegacy.created_at || new Date().toISOString(),
    };
  }

  function processResponse(data) {
    const instructions = extractInstructions(data);
    const bookmarks = [];

    for (const instruction of instructions) {
      if (instruction.type !== 'TimelineAddEntries') continue;

      for (const entry of instruction.entries || []) {
        // Standard single-tweet entry
        let tweetResult =
          entry?.content?.itemContent?.tweet_results?.result;

        // Module/multi-item entries
        if (!tweetResult) {
          for (const item of entry?.content?.items || []) {
            const r = item?.item?.itemContent?.tweet_results?.result;
            if (r) { tweetResult = r; break; }
          }
        }

        const bookmark = parseTweet(tweetResult);
        if (bookmark) bookmarks.push(bookmark);
      }
    }

    return bookmarks;
  }

  function handleResponseData(url, data) {
    if (isBookmarkEndpoint(url)) {
      const bookmarks = processResponse(data);
      if (bookmarks.length > 0) {
        window.postMessage(
          { source: 'bookmarkd-injected', action: 'BOOKMARKS_CAPTURED', bookmarks },
          '*'
        );
      }
    }
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
      response.clone().json().then((data) => handleResponseData(url, data)).catch(() => {});
    } catch (_) {}
    return response;
  };

  // Intercept XHR (fallback in case X uses XMLHttpRequest)
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this._bookmarkdUrl = url;
    return originalOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        const url = this._bookmarkdUrl || '';
        if (isBookmarkEndpoint(url)) {
          const data = JSON.parse(this.responseText);
          handleResponseData(url, data);
        }
      } catch (_) {}
    });
    return originalSend.apply(this, arguments);
  };
})();
