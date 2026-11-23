# Conversor

App desktop para Windows de compressão e conversão de vídeo, com Tauri 2, React, TypeScript e FFmpeg.

## Requisitos

- Node.js 20+
- Rust (rustup) e Visual Studio Build Tools com workload de C++
- WebView2 (já incluso no Windows 10/11)

## FFmpeg sidecar

Os binários ficam em `src-tauri/binaries/` com o sufixo do target Windows:

- `ffmpeg-x86_64-pc-windows-msvc.exe`
- `ffprobe-x86_64-pc-windows-msvc.exe`

Para baixar de novo:

```powershell
npm run ffmpeg:download
```

## yt-dlp sidecar

Usado no download de vídeos (YouTube e outros sites reconhecidos pelo yt-dlp):

```powershell
npm run ytdlp:download
```

O binário fica em `src-tauri/binaries/yt-dlp-x86_64-pc-windows-msvc.exe`.

## Desenvolvimento

```powershell
npm install
npm run tauri dev
```

## Presets

- Comprimir web (H.264 CRF)
- Comprimir qualidade (H.265 CRF)
- Converter MP4
- Extrair áudio
- GPU NVENC (quando a placa NVIDIA estiver disponível)
