#!/usr/bin/env bash
set -euo pipefail

echo ">>> Copying project sources to /app..."
mkdir -p /app /app/src-tauri/binaries
tar -C /src \
  --exclude='./node_modules' \
  --exclude='./src-tauri/target' \
  --exclude='./src-tauri/binaries' \
  --exclude='./dist' \
  --exclude='./dist-linux' \
  --exclude='./.git' \
  --exclude='./.vitest' \
  -cf - . | tar -C /app -xf -

echo ">>> Downloading Linux sidecars (ffmpeg, ffprobe, yt-dlp)..."
curl -fsSL "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl.tar.xz" -o /tmp/ffmpeg.tar.xz
tar -xJf /tmp/ffmpeg.tar.xz -C /tmp
FFMPEG_DIR="$(find /tmp -maxdepth 1 -type d -name 'ffmpeg-master-latest-linux64-gpl' | head -n 1)"
cp "${FFMPEG_DIR}/bin/ffmpeg" /app/src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu
cp "${FFMPEG_DIR}/bin/ffprobe" /app/src-tauri/binaries/ffprobe-x86_64-unknown-linux-gnu
rm -rf /tmp/ffmpeg.tar.xz "${FFMPEG_DIR}"

curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux" -o /app/src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu
chmod +x /app/src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu \
         /app/src-tauri/binaries/ffprobe-x86_64-unknown-linux-gnu \
         /app/src-tauri/binaries/yt-dlp-x86_64-unknown-linux-gnu

echo ">>> Installing npm dependencies..."
cd /app
npm ci

echo ">>> Building Tauri app for Linux..."
export APPIMAGE_EXTRACT_AND_RUN=1
npm run tauri build

echo ">>> Exporting Linux bundles to /out..."
mkdir -p /out
cp -v /app/src-tauri/target/release/mediakit /out/mediakit
find /app/src-tauri/target/release/bundle -type f \( -name '*.deb' -o -name '*.AppImage' -o -name '*.sig' \) -exec cp -v {} /out/ \;
echo ">>> Done!"
ls -lh /out
