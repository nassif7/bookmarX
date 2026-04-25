// filepath: chrome/content/content.js
/**
 * Content script that intercepts X (Twitter) API responses
 * to capture bookmark data automatically
 */

(function() {
  'use strict';

  // Configuration
  const API_ENDPOINTS = [
    '/graphql/BookmarkFavorites',
    '/graphql/Bookmarks',
    '/i/api/graphql/BookmarkFavorites',
    '/i/api/graphql/Bookmarks'
  ];

  // Track if we've already processed this response
  const processedResponseIds = new Set();

  /**
   * Extract bookmark data from X's API response
   */
  function extractBookmarkData(entry) {
    try {
      const content = entry?.content;
      if (!content) return null;

      // Handle different response formats
      const tweet = content?.item?.content?.tweet || 
                    content?.tweet || 
                    content?.__typename === 'Tweet' ? content : null;

      if (!tweet) return null;

      const tweetId = tweet.rest_id || tweet.id_str;
      if (!tweetId || processedResponseIds.has(tweetId)) {
        return null;
      }
      processedResponseIds.add(tweetId);

      // Extract user data
      const user = tweet.core?.user || tweet.user || {};
      
      // Extract media if present
      const media = [];
      if (tweet.legacy?.entities?.media) {
        tweet.legacy.entities.media.forEach(m => {
          media.push({
            type: m.type,
            url: m.media_url_https || m.url,
            preview: m.url
          });
        });
      }

      // Extract hashtags and mentions
      const hashtags = tweet.legacy?.entities?.hashtags?.map(h => h.text) || [];
      const mentions = tweet.legacy?.entities?.user_mentions?.map(m => m.name) || [];

      return {
        id: tweetId,
        text: tweet.legacy?.full_text || tweet.full_text || '',
        authorName: user.name || user.displayName || '',
        authorHandle: user.screen_name || user.username || '',
        authorAvatar: user.profile_image_url_https || user.profile_image_url || '',
        tweetUrl: `https://x.com/${user.screen_name}/status/${tweetId}`,
        dateBookmarked: new Date().toISOString(),
        media: media,
        hashtags: hashtags,
        mentions: mentions,
        createdAt: tweet.legacy?.created_at || tweet.created_at || new Date().toISOString()
      };
    } catch (error) {
      console.error('Bookmarkd: Error extracting bookmark data', error);
      return null;
    }
  }

  /**
   * Process GraphQL response entries
   */
  function processGraphQLResponse(data) {
    const bookmarks = [];
    
    // Navigate through the nested structure
    const instructions = data?.data?.bookmarkDetails?.listings || 
                        data?.data?.bookmarks?.listings ||
                        data?.data?.user?.bookmarkList?.listings ||
                        [];

    instructions.forEach(entry => {
      const bookmark = extractBookmarkData(entry);
      if (bookmark) {
        bookmarks.push(bookmark);
      }
    });

    return bookmarks;
  }

  /**
   * Send bookmarks to background script
   */
  function sendToBackground(action, data) {
    chrome.runtime.sendMessage({
      action: action,
      data: data
    }).catch(error => {
      console.error('Bookmarkd: Error sending to background', error);
    });
  }

  /**
   * Intercept fetch requests
   */
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    
    try {
      const url = args[0]?.url || args[0];
      const isBookmarkEndpoint = API_ENDPOINTS.some(endpoint => 
        url.includes(endpoint)
      );

      if (isBookmarkEndpoint) {
        const clonedResponse = response.clone();
        clonedResponse.json().then(data => {
          const bookmarks = processGraphQLResponse(data);
          if (bookmarks.length > 0) {
            console.log(`Bookmarkd: Captured ${bookmarks.length} bookmark(s)`);
            sendToBackground('BOOKMARKS_CAPTURED', { bookmarks });
          }
        }).catch(() => {});
      }
    } catch (error) {
      // Silently ignore errors
    }

    return response;
  };

  /**
   * Intercept XHR requests
   */
  const originalXHROpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this._isBookmarkRequest = API_ENDPOINTS.some(endpoint => 
      url.includes(endpoint)
    );
    return originalXHROpen.call(this, method, url, ...rest);
  };

  const originalXHRSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener('load', function() {
      if (this._isBookmarkRequest) {
        try {
          const data = JSON.parse(this.responseText);
          const bookmarks = processGraphQLResponse(data);
          if (bookmarks.length > 0) {
            console.log(`Bookmarkd: Captured ${bookmarks.length} bookmark(s) via XHR`);
            sendToBackground('BOOKMARKS_CAPTURED', { bookmarks });
          }
        } catch (error) {
          // Silently ignore parse errors
        }
      }
    });
    return originalXHRSend.apply(this, args);
  };

  /**
   * Listen for messages from popup or background
   */
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'GET_PAGE_INFO') {
      sendResponse({
        url: window.location.href,
        isX: window.location.hostname.includes('x.com') || 
             window.location.hostname.includes('twitter.com')
      });
    }
    return true;
  });

  console.log('Bookmarkd: Content script loaded');
})();