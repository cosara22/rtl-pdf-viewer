# Change Log

All notable changes to the "rtl-pdf-viewer" extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
