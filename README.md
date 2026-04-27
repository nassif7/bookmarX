# BookmarX - X (Twitter) Bookmark Manager

A browser extension that helps X (Twitter) users manage their bookmarks properly with categories, tags, and powerful search.

## Support the Project

If you find BookmarX useful, consider supporting its development:

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nn498137)

## Features

- 🔍 **Search** - Search bookmarks by keyword
- 📁 **Categories** - Create, rename, delete categories (like folders)
- 🏷️ **Tags** - Assign tags to bookmarks
- 📌 **Organize** - Assign bookmarks to a category
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

> **Note:** BookmarX is not yet published to the Chrome Web Store. Follow the steps below to install it locally in developer mode.

### Chrome

1. [Download or clone this repository](https://github.com/nassif/bookmarX) to your machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** using the toggle in the top-right corner
4. Click **Load unpacked**
5. Select the `chrome` folder inside the project directory
6. The BookmarX icon should appear in your extensions bar — pin it for easy access
7. Visit [x.com](https://x.com) and open your bookmarks to start syncing

### Firefox

> 🚧 Firefox support is coming soon.

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
```

## Storage

- Uses Chrome local extension storage
- No server required — all data stays on your machine

## License

MIT
