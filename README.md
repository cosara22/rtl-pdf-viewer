# RTL PDF Viewer

**English** | [日本語](./README.ja.md)

[![CI](https://github.com/cosara22/rtl-pdf-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/cosara22/rtl-pdf-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![GitHub release](https://img.shields.io/github/v/release/cosara22/rtl-pdf-viewer?include_prereleases)](https://github.com/cosara22/rtl-pdf-viewer/releases)

A VS Code custom editor extension that lets you read PDFs with **right-to-left horizontal scrolling** (manga / Japanese vertical-text book style).

## Features

- ✅ **Right-to-left horizontal scrolling** (manga / Japanese book style)
- ✅ **Left-to-right horizontal scrolling** (Western book style)
- ✅ **Vertical scrolling** (standard mode)
- ✅ Page navigation with arrow keys (auto-inverted in RTL mode)
- ✅ Zoom controls (zoom in / out / fit-to-width)
- ✅ Configurable defaults via settings
- ✅ Toolbar for instant direction switching
- ✅ Lazy page rendering with IntersectionObserver

## Why this exists

Adobe Acrobat doesn't have a true horizontal scroll mode, and most PDF readers don't combine **horizontal scroll + RTL page order** — the natural way to read manga or Japanese books. Specialized comic readers exist (SumatraPDF, Honeyview), but if you live inside VS Code, switching apps just to read a book breaks the flow. This extension brings that reading experience directly into the editor.

## Setup

### 1. Install dependencies

```powershell
cd rtl-pdf-viewer
npm install
```

### 2. Download PDF.js

```powershell
npm run setup
```

This downloads PDF.js v4.7.76 into `media/pdfjs/`.

### 3. Compile TypeScript

```powershell
npm run compile
```

### 4. Run in development mode (recommended)

1. Open the `rtl-pdf-viewer` folder in VS Code
2. Press `F5` → Extension Development Host opens in a new window
3. In the new window, open any PDF — "RTL PDF Viewer" appears in the editor selector
4. To make it default: Right-click PDF → "Open With..." → "RTL PDF Viewer" → "Configure default editor for .pdf"

### 5. Package as VSIX

```powershell
npm run package
```

Generates `rtl-pdf-viewer-0.0.1.vsix`.

### 6. Install the VSIX

```powershell
code --install-extension rtl-pdf-viewer-0.0.1.vsix
```

## Usage

### Open a PDF with RTL Viewer

1. Right-click a `.pdf` file
2. **"Open With..."**
3. Select **"RTL PDF Viewer"**

### Toolbar

| Button | Action |
|--------|--------|
| ◀ Prev / Next ▶ | Page navigation |
| − / ＋ | Zoom out / in |
| Fit Width | Fit page to viewer width |
| ↔ Direction | Toggle RTL ⇔ LTR |
| ⇅ Scroll | Toggle horizontal ⇔ vertical |
| 📖 Spread | Toggle two-page spread |

### Keyboard shortcuts (in RTL horizontal mode)

| Key | Action |
|-----|--------|
| `→` | Previous page (it's on the right) |
| `←` | Next page (it's on the left) |
| `↓` / `Space` / `PageDown` | Next page |
| `↑` / `PageUp` | Previous page |
| `Home` | Jump to first page |
| `End` | Jump to last page |
| Mouse wheel | Horizontal scroll (vertical wheel → horizontal movement) |

In LTR or vertical mode, keys map to the natural direction.

## Configuration

In `settings.json`:

```json
{
  "rtlPdfViewer.readingDirection": "rtl",     // "rtl" or "ltr"
  "rtlPdfViewer.scrollMode": "horizontal",     // "horizontal" or "vertical"
  "rtlPdfViewer.spread": false,                // two-page spread
  "rtlPdfViewer.defaultScale": 1.5             // 0.5 - 3.0
}
```

## Project structure

```
rtl-pdf-viewer/
├── package.json              # Extension manifest
├── tsconfig.json
├── .vscodeignore
├── src/
│   └── extension.ts          # CustomEditorProvider implementation
├── media/
│   ├── viewer.css            # RTL horizontal scroll styles
│   ├── viewer.js             # PDF.js integration & UI logic
│   └── pdfjs/                # PDF.js (downloaded by setup)
├── scripts/
│   └── download-pdfjs.js     # PDF.js fetch script
└── .vscode/
    ├── launch.json
    └── tasks.json
```

## How it works

The extension registers a `CustomReadonlyEditorProvider` for `.pdf` files. When a PDF is opened, it spins up a WebView that:

1. Loads PDF.js as an ES module
2. Renders each page to a `<canvas>` element
3. Arranges canvases in a flex container with `direction: rtl` (or `ltr`)
4. Uses `overflow-x: auto` to enable horizontal scrolling
5. Lazy-renders only visible pages via `IntersectionObserver` for performance

The key CSS:

```css
#viewer[data-scroll="horizontal"][data-direction="rtl"] {
  display: flex;
  flex-direction: row;
  direction: rtl;       /* page 1 on the right, page N on the left */
  overflow-x: auto;
}
```

## Known limitations (prototype)

- No text search
- No text selection (canvas-based rendering)
- No outline / bookmarks
- Large PDFs may take time on initial load
- PDFs without embedded Japanese fonts may display garbled text (CMaps not bundled)

These are future enhancement targets.

## Troubleshooting

### "RTL PDF Viewer" doesn't appear in the editor selector
- Verify the extension is installed: `code --list-extensions | findstr rtl-pdf`
- Restart VS Code

### PDF appears blank
- Open Developer Tools: `Ctrl+Shift+P` → "Developer: Toggle Developer Tools" → check console errors
- Verify PDF.js was downloaded: `media/pdfjs/pdf.min.mjs` should exist

### Compile errors
- Make sure `npm install` succeeded
- Check `node_modules/@types/vscode` exists

## Tech stack

- **TypeScript** — extension host code
- **VS Code Custom Editor API** — `CustomReadonlyEditorProvider`
- **PDF.js** v4.7.76 — Mozilla's PDF rendering engine
- **WebView API** — sandboxed HTML/CSS/JS rendering

## Contributing

Contributions welcome. Please open an issue first for major changes.

## Publishing

See [PUBLISHING.md](./PUBLISHING.md) for the release workflow and VS Code Marketplace setup.

## License

[MIT](./LICENSE)
