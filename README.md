# Bookmarkd - X (Twitter) Bookmark Manager

A browser extension that helps X (Twitter) users manage their bookmarks properly with categories, tags, and powerful search.

## Features

- 🔍 **Search** - Search bookmarks by keyword
- 📁 **Categories** - Create, rename, delete categories (like folders)
- 🏷️ **Tags** - Create tags and assign multiple tags to a bookmark
- 📌 **Organize** - Assign bookmarks to a category, add tags
- 🗑️ **Delete** - Delete bookmarks from the UI
- 📤 **Export** - Export all bookmarks as CSV or JSON
- 📸 **Media** - Capture and display media from bookmarked tweets

## How It Works

1. When you visit x.com, the extension automatically intercepts X's internal API responses that contain bookmark data
2. Bookmarks are saved to local extension storage automatically — no manual trigger needed
3. Click the extension icon to open the full management UI

## Data Captured

- Tweet text
- Author name
- Author handle
- Tweet URL
- Date bookmarked
- Media (if any)
- Hashtags and mentions

## Installation

### Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the `chrome` folder in this project

### Firefox

1. Open Firefox and navigate to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on..."
3. Select any file in the `firefox` folder (e.g., manifest.json)

## Project Structure

```
bookmarX/
├── chrome/
│   ├── manifest.json          # Chrome manifest (MV3)
│   ├── background/
│   │   └── background.js      # Service worker
│   ├── content/
│   │   └── content.js        # Content script (API interception)
│   ├── popup/
│   │   ├── popup.html        # Popup UI
│   │   ├── popup.js          # Popup logic
│   │   └── styles.css        # UI styles
│   └── icons/                # Extension icons
└── firefox/
    └── (same structure)
```

## Storage

- Uses Chrome/Firefox local extension storage
- No server required - all data stays local

## License

MIT