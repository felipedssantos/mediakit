# Third-Party Notices

MediaKit's source code is licensed under the [MIT License](LICENSE). When built or distributed with sidecar binaries, the following third-party components are included or downloaded separately:

## FFmpeg & FFprobe (GyanD/codexffmpeg)

- **Upstream**: https://ffmpeg.org/ | https://github.com/GyanD/codexffmpeg
- **License**: GNU General Public License v3.0 or later (GPL-3.0-or-later), depending on the build configuration (`essentials_build`).
- **Source code**: Corresponding FFmpeg source code and build scripts are available from the upstream repositories listed above.
- **Note**: Sidecar executables are not committed to this repository; they are downloaded via `npm run ffmpeg:download` or at runtime with SHA-256 verification.

## yt-dlp

- **Upstream**: https://github.com/yt-dlp/yt-dlp
- **License**: The Unlicense (Public Domain)
- **Note**: Sidecar executable is not committed to this repository; it is downloaded via `npm run ytdlp:download` or at runtime with SHA-256 verification.
