// Runs in the MAIN world — same JS context as X's own code.
// Intercepts fetch to capture bookmark API responses, then
// forwards to content.ts (isolated world) via postMessage.
(function () {
  'use strict';

  function isBookmarkEndpoint(url: string): boolean {
    return (
      url.includes('x.com') || url.includes('twitter.com') || url.startsWith('/')
    ) && /Bookmark/.test(url);
  }

  function extractInstructions(data: Record<string, unknown>): unknown[] {
    const d = data?.data as Record<string, unknown> | undefined;
    return (
      (d?.bookmark_timeline_v2 as Record<string, unknown> | undefined)?.timeline as Record<string, unknown> | undefined
    )?.instructions as unknown[] ||
      ((d?.bookmark_timeline as Record<string, unknown> | undefined)?.timeline as Record<string, unknown> | undefined)?.instructions as unknown[] ||
      ((d?.bookmarks as Record<string, unknown> | undefined)?.timeline as Record<string, unknown> | undefined)?.instructions as unknown[] ||
      ((d?.bookmarkDetails as Record<string, unknown> | undefined)?.timeline as Record<string, unknown> | undefined)?.instructions as unknown[] ||
      [];
  }

  interface ParsedBookmark {
    id: string;
    text: string;
    authorName: string;
    authorHandle: string;
    authorAvatar: string;
    tweetUrl: string;
    dateBookmarked: string;
    media: Array<{ type: string; url: string }>;
    mediaType: string;
    hashtags: string[];
    mentions: string[];
    createdAt: string;
  }

  function parseTweet(tweetResult: Record<string, unknown> | null | undefined): ParsedBookmark | null {
    if (!tweetResult) return null;

    const tweet = (tweetResult.__typename === 'TweetWithVisibilityResults'
      ? (tweetResult as Record<string, unknown>).tweet
      : tweetResult) as Record<string, unknown> | null;

    if (!tweet || tweet.__typename !== 'Tweet') return null;

    const tweetId = tweet.rest_id as string | undefined;
    if (!tweetId) return null;

    const userResult = ((tweet.core as Record<string, unknown>)?.user_results as Record<string, unknown>)?.result as Record<string, unknown> | undefined;
    const userCore = (userResult?.core as Record<string, unknown>) ?? {};
    const userLegacy = (userResult?.legacy as Record<string, unknown>) ?? {};
    const tweetLegacy = (tweet.legacy as Record<string, unknown>) ?? {};

    const mediaItems = [
      ...((tweetLegacy.extended_entities as Record<string, unknown[]> | undefined)?.media ?? []),
      ...((tweetLegacy.entities as Record<string, unknown[]> | undefined)?.media ?? []),
    ] as Array<Record<string, unknown>>;

    const seenMedia = new Set<string>();
    const media: Array<{ type: string; url: string }> = [];
    for (const m of mediaItems) {
      const key = (m.media_url_https || m.url) as string;
      if (!seenMedia.has(key)) {
        seenMedia.add(key);
        media.push({ type: m.type as string, url: key });
      }
    }

    const authorHandle = (userCore.screen_name || userLegacy.screen_name || '') as string;

    let mediaType = 'post';
    if (media.some(m => m.type === 'video' || m.type === 'animated_gif')) mediaType = 'video';
    else if (media.some(m => m.type === 'photo')) mediaType = 'photo';
    else if (
      tweetLegacy.in_reply_to_screen_name &&
      authorHandle &&
      (tweetLegacy.in_reply_to_screen_name as string).toLowerCase() === authorHandle.toLowerCase()
    ) mediaType = 'thread';

    return {
      id: tweetId,
      text: (tweetLegacy.full_text as string) || '',
      authorName: ((userCore.name || userLegacy.name) as string) || '',
      authorHandle,
      authorAvatar: ((userResult as Record<string, Record<string, string>> | undefined)?.avatar?.image_url || userLegacy.profile_image_url_https as string) || '',
      tweetUrl: `https://x.com/${authorHandle}/status/${tweetId}`,
      dateBookmarked: new Date().toISOString(),
      media,
      mediaType,
      hashtags: ((tweetLegacy.entities as Record<string, Array<{ text: string }>> | undefined)?.hashtags ?? []).map(h => h.text),
      mentions: ((tweetLegacy.entities as Record<string, Array<{ screen_name: string }>> | undefined)?.user_mentions ?? []).map(m => m.screen_name),
      createdAt: (tweetLegacy.created_at as string) || new Date().toISOString(),
    };
  }

  function processResponse(data: Record<string, unknown>): ParsedBookmark[] {
    const instructions = extractInstructions(data);
    const bookmarks: ParsedBookmark[] = [];

    for (const instruction of instructions) {
      const instr = instruction as Record<string, unknown>;
      if (instr.type !== 'TimelineAddEntries') continue;

      for (const entry of (instr.entries as Array<Record<string, unknown>>) ?? []) {
        let tweetResult = (entry?.content as Record<string, unknown>)?.itemContent as Record<string, unknown> | undefined;
        tweetResult = (tweetResult?.tweet_results as Record<string, unknown>)?.result as Record<string, unknown> | undefined;

        if (!tweetResult) {
          for (const item of ((entry?.content as Record<string, unknown>)?.items as Array<Record<string, unknown>>) ?? []) {
            const r = ((item?.item as Record<string, unknown>)?.itemContent as Record<string, unknown>)?.tweet_results as Record<string, unknown> | undefined;
            if (r?.result) { tweetResult = r.result as Record<string, unknown>; break; }
          }
        }

        const bookmark = parseTweet(tweetResult as Record<string, unknown> | null);
        if (bookmark) bookmarks.push(bookmark);
      }
    }

    return bookmarks;
  }

  function handleResponseData(url: string, data: Record<string, unknown>): void {
    if (isBookmarkEndpoint(url)) {
      const bookmarks = processResponse(data);
      if (bookmarks.length > 0) {
        window.postMessage({ source: 'bookmarx-injected', action: 'BOOKMARKS_CAPTURED', bookmarks }, '*');
      }
    }
  }

  // Intercept fetch
  const originalFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args);
    try {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request)?.url || '';
      response.clone().json().then((data: Record<string, unknown>) => handleResponseData(url, data)).catch(() => {});
    } catch (_) {}
    return response;
  };

  // Intercept XHR
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method: string, url: string | URL) {
    (this as XMLHttpRequest & { _bookmarxUrl: string })._bookmarxUrl = url.toString();
    return originalOpen.apply(this, arguments as unknown as Parameters<typeof originalOpen>);
  };

  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function (this: XMLHttpRequest & { _bookmarxUrl: string }) {
      try {
        const url = this._bookmarxUrl || '';
        if (isBookmarkEndpoint(url)) {
          const data = JSON.parse(this.responseText) as Record<string, unknown>;
          handleResponseData(url, data);
        }
      } catch (_) {}
    });
    return originalSend.apply(this, arguments as unknown as Parameters<typeof originalSend>);
  };
})();
