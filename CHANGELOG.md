# Change Log

All notable changes to the "rtl-pdf-viewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.5] - 2026-08-15

### Changed
- Restructured the README so the Marketplace page speaks to readers before
  contributors. `Installation` now sits where the build instructions used to be,
  and the `npm install` / PDF.js download / TypeScript compile steps moved down
  to a `Development` section.

  The extension ships PDF.js inside the package (`media/pdfjs/pdf.min.mjs` and
  `pdf.worker.min.mjs`, verified in the published 0.0.4 VSIX), so anyone
  installing from the Marketplace has nothing to download or build. The old
  layout implied otherwise on the first screen of the extension page.

### Fixed
- The packaging step no longer names a stale artifact (`rtl-pdf-viewer-0.0.1.vsix`
  when the current version was 0.0.4).

## [0.0.4] - 2026-05-03

### Added
- Pinch zoom in 10% increments. Trackpad pinch (Ctrl+wheel) and
  two-finger touch pinch are both supported.
- Throttled rerender (120ms debounce) so rapid pinch gestures do
  not trigger multiple expensive re-renders.

### Changed
- Zoom range expanded from 0.5–3.0 to 0.25–5.0.
- Zoom buttons now use a shared `applyZoom` helper for consistency
  with pinch behavior.

## [0.0.3] - 2026-05-03

### Added
- HiDPI / Retina display support: PDF pages now render at the device's
  physical pixel resolution for crisp display on high-DPI screens.
- New `rtlPdfViewer.renderQuality` setting (1.0–4.0, default 2.0) for
  configurable supersampling. Higher values produce sharper output at
  the cost of memory and rendering time.
- Quality toggle button in the toolbar that cycles through 1x → 2x →
  3x → 4x quality levels with live re-rendering.

### Changed
- Page rendering now decouples internal canvas resolution from CSS
  display size, eliminating blur on Retina/4K displays.

## [0.0.2] - 2026-05-03

### Added
- Extension icon (navy document with gold right-to-left arrow on cream rounded-square background, StockCompass branding).

## [0.0.1] - 2026-05-03

### Added
- Initial prototype release.
- Right-to-left horizontal scroll PDF viewer (manga / Japanese book style).
- Left-to-right horizontal scroll mode (Western book style).
- Vertical scroll mode.
- Page navigation with arrow keys (auto-inverted in RTL mode).
- Zoom controls (zoom in / out / fit-to-width).
- Toolbar for instant direction switching.
- Settings: `readingDirection`, `scrollMode`, `spread`, `defaultScale`.
- Lazy page rendering with IntersectionObserver.
