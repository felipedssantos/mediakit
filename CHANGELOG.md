# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2026-11-28

### Added

- In-app automatic updater powered by `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`, checking GitHub Releases (`latest.json`) on startup with cryptographic signature verification.
- Redesigned `UpdateBanner` component with version transition badge (`current → next`), release date, signed-release indicator, expandable release notes, real-time MB/percentage download progress bar, error retry, and one-click update & restart.
- Full localization for the updater banner across all supported languages (`en`, `pt-BR`, `pt-PT`, `es`, `fr`).
- Mandatory release signing guidelines in `AGENTS.md`, `CONTRIBUTING.md`, and `README.md`.

## [0.3.0] - 2026-11-26

### Added

- Interactive screenshot & annotation overlay enabled by default (`SCREENSHOT_ENABLED = true`), triggered via `Print Screen`, `Alt+Shift+S`, the system tray menu, or the **Screenshot** page.
- Full screen, hovered window, and free-drag region selection (`Esc` to cancel, `Backspace` to reselect).
- Annotation toolbar with color swatches, **Adjust** (`1`), **Pen** (`2`), **Arrow** (`3`), **Rectangle** (`4`), **Ellipse** (`5`), **Text** (`6`), **Pixelate** mosaic obfuscation (`7`), and **Undo** (`Ctrl+Z`).
- Direct clipboard copy (`Enter`), PNG save (`Ctrl+S`) to a configurable destination folder, and persistent capture history on the **Screenshot** page.

### Fixed

- Conditionally compiled Windows-only clipboard helpers for Linux CI compatibility.

## [0.2.0] - 2026-11-23

### Added

- Linux x64 support with `.deb` and `.AppImage` bundle targets in Tauri config.
- Cross-platform sidecar binary resolution (`ffmpeg`, `ffprobe`, `yt-dlp`) without hardcoded `.exe` extensions and automatic `PATH` fallback on Linux/macOS.
- Browser cookie profile path detection for Linux (`$XDG_CONFIG_HOME` / `~/.config`, `~/.mozilla/firefox`) and macOS (`~/Library/Application Support`).
- Linux CI job (`ubuntu-24.04`) running `rustfmt`, `clippy`, and `cargo test`.
- Docker-based Linux build environment (`scripts/Dockerfile.linux` and `scripts/build-linux.sh`).

### Changed

- Restricted Windows-only sidecar auto-repair (`GyanD/codexffmpeg` / `yt-dlp.exe`), `--windows-filenames`, and `.exe` file picker filters to Windows targets.
- Updated UI labels across all locales (`en`, `pt-BR`, `pt-PT`, `es`, `fr`) to use OS-neutral terminology.

## [0.1.0] - 2026-11-23

### Added

- Local video compression and conversion presets (H.264, H.265, NVIDIA NVENC, MP4/MKV/MOV/WebM/AVI, and audio extraction to M4A/MP3/WAV/OGG/FLAC).
- Local image compression and conversion (JPEG, PNG, WebP, BMP, TIFF; supporting HEIC, AVIF, GIF, and standard raster inputs).
- Media downloading via `yt-dlp` sidecar with video quality selection, audio extraction, and local browser cookie fallback.
- Batch job queues with live progress, concurrency control, cancel, and retry actions.
- Windows system tray integration (minimize/close to tray) and autostart support.
- Experimental screenshot & annotation overlay (`SCREENSHOT_ENABLED = false` by default).
- Open-source repository setup: MIT license, contributing guidelines, code of conduct, security policy, CI workflow, ESLint/Prettier/Vitest, `rustfmt`/Clippy, pinned sidecar SHA-256 downloads, and architecture docs.

[0.4.0]: https://github.com/felipedssantos/mediakit/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/felipedssantos/mediakit/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/felipedssantos/mediakit/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/felipedssantos/mediakit/releases/tag/v0.1.0
