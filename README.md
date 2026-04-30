# bookmarX — X (Twitter) Bookmark Manager

![Version](https://img.shields.io/badge/version-1.0.0-blue)

A Chrome extension to manage your X bookmarks with collections, tags, filters, and smart search — all stored locally, no account needed.

## Support the Project

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/nn498137)

## Features

- **Sync** — Auto-scrolls your X bookmarks page and captures everything
- **Collections** — Create keyword-based collections that auto-sort bookmarks as you sync
- **Tags & media filters** — Filter by tag or media type (photo, video, thread, post)
- **Search** — Search across tweet text, author, handle, and hashtags
- **Bookmark detail** — View full tweet, assign to a collection, see tags
- **Import / Export** — Export as JSON or CSV; re-import a previous export with deduplication
- **Themes** — Light, dark, or system theme with a custom accent color

## How It Works

1. Open [x.com/i/bookmarks](https://x.com/i/bookmarks) in Chrome
2. Click the sync button in the bookmarX side panel
3. The extension auto-scrolls through your bookmarks and captures them
4. Browse, filter, and organize from the side panel — data stays on your machine

## Installation

> bookmarX is not yet published to the Chrome Web Store. Install it locally in developer mode.

### Prerequisites

- [Node.js](https://nodejs.org) 18+
- npm

### Build

```bash
git clone https://github.com/nassif/bookmarX
cd bookmarX
npm install
npm run build
```

### Load in Chrome

1. Navigate to `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` folder
5. Pin the bookmarX icon and open the side panel from any tab

### Development

```bash
npm run dev   # watch mode — rebuilds on every save
```

After each rebuild, go to `chrome://extensions/` and click the reload button on bookmarX to pick up changes.

## Project Structure

```
bookmarX/
├── src/
│   ├── manifest.json              # Chrome MV3 manifest
│   ├── types.ts                   # Shared TypeScript types
│   ├── background/
│   │   └── background.ts          # Service worker (storage, message handling)
│   ├── content/
│   │   ├── content.ts             # Content script (API interception)
│   │   └── injected.ts            # MAIN world script (XHR/fetch hooks)
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── styles.css
│   │   ├── App.tsx                # Root component and state
│   │   ├── components/            # UI components
│   │   └── lib/                   # Utilities and Chrome messaging
│   └── public/
│       └── icons/                 # Extension icons
├── dist/                          # Built extension (load this in Chrome)
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## Storage

All data is stored in Chrome's local extension storage. Nothing is sent to any server.

## License

MIT
