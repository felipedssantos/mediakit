# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-11-23

### Added
- Local video compression and conversion presets (H.264, H.265, NVIDIA NVENC, MP4/MKV/MOV/WebM/AVI, and audio extraction to M4A/MP3/WAV/OGG/FLAC).
- Local image compression and conversion (JPEG, PNG, WebP, BMP, TIFF; supporting HEIC, AVIF, GIF, and standard raster inputs).
- Media downloading via `yt-dlp` sidecar with video quality selection, audio extraction, and local browser cookie fallback.
- Batch job queues with live progress, concurrency control, cancel, and retry actions.
- Windows system tray integration (minimize/close to tray) and autostart support.
- Experimental screenshot & annotation overlay (`SCREENSHOT_ENABLED = false` by default).
- Open-source repository setup: MIT license, contributing guidelines, code of conduct, security policy, CI workflow, ESLint/Prettier/Vitest, `rustfmt`/Clippy, pinned sidecar SHA-256 downloads, and architecture docs.
