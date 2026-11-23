# MediaKit

App desktop para Windows de compressão e conversão local de vídeo, imagem e áudio, além de download de mídia com FFmpeg e yt-dlp embutidos como sidecars.

> **English summary below** — [Read the English overview](#english-overview)

## Visão geral

O MediaKit roda 100% localmente na máquina do usuário usando **Tauri 2**, **React 19**, **TypeScript** e **Rust**, sem envio de arquivos para servidores externos:

- **Vídeo e áudio**: comprimir para envio rápido (H.264), comprimir preservando qualidade (H.265), acelerar via GPU NVIDIA (`h264_nvenc`), converter entre containers (`MP4`, `MKV`, `MOV`, `WebM`, `AVI`) e extrair áudio (`M4A`, `MP3`, `WAV`, `OGG`, `FLAC`).
- **Imagens**: comprimir ou converter entre `JPEG`, `PNG`, `WebP`, `BMP` e `TIFF` (entrada inclui `JPG`, `PNG`, `WebP`, `BMP`, `TIFF`, `GIF`, `HEIC`, `HEIF`, `AVIF`).
- **Download de vídeos**: baixar vídeo ou apenas áudio do YouTube e outros sites compatíveis com `yt-dlp`, com suporte a cookies de navegadores locais quando necessário.
- **Fila e bandeja**: processamento em fila com progresso, cancelamento, reenvio de jobs e minimização para a bandeja do sistema.
- **Captura de tela (experimental)**: desativada por padrão via `SCREENSHOT_ENABLED` em `src/lib/features.ts`.

## Screenshots

<!-- Adicione capturas reais do app antes de publicar a release -->
| Tela inicial | Conversão em fila | Download de vídeo |
| --- | --- | --- |
| _Em breve_ | _Em breve_ | _Em breve_ |

## Requisitos

- **Windows 10 ou 11** (x64)
- **Node.js 20+** (este repositório usa `npm`)
- **Rust** (`rustup` estável) + Visual Studio Build Tools (workload C++)
- **WebView2** (incluso no Windows 10/11)

## Setup local

1. Clone o repositório e instale as dependências JS:

```powershell
git clone https://github.com/felipedssantos/mediakit.git
cd mediakit
npm install
```

2. Baixe os binários sidecar (`ffmpeg`, `ffprobe` e `yt-dlp`) para `src-tauri/binaries/`:

```powershell
npm run ffmpeg:download
npm run ytdlp:download
```

> Os scripts usam versões fixas com verificação de checksum SHA-256. Os executáveis ficam ignorados pelo Git (`src-tauri/.gitignore`) e não devem ser commitados.

3. Execute o app em modo de desenvolvimento:

```powershell
npm run tauri dev
```

## Scripts disponíveis

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Sobe apenas o servidor Vite do frontend |
| `npm run build` | Compila TypeScript (`tsc`) e gera bundle de produção (`vite build`) |
| `npm run preview` | Visualiza o bundle gerado localmente |
| `npm run tauri dev` | Inicia o app desktop completo (frontend + backend Rust) |
| `npm run tauri build` | Gera o instalador Windows (NSIS) |
| `npm run ffmpeg:download` | Baixa `ffmpeg` e `ffprobe` para `src-tauri/binaries/` |
| `npm run ytdlp:download` | Baixa `yt-dlp` para `src-tauri/binaries/` |

## Arquitetura resumida

- **Frontend (`src/`)**: React 19 + Vite 8 + Tailwind CSS v4 + Zustand 5. As telas (`HomePage`, `ConverterPage`, `ImageConverterPage`, `YoutubePage`) disparam comandos Tauri e escutam eventos de progresso/fila.
- **Backend (`src-tauri/src/`)**: comandos Tauri (`commands.rs`), gerenciamento de filas e jobs (`manager/`, `youtube/`), construção de presets (`presets/`), inspeção de mídia (`probe/`), workers de execução (`worker/`, `youtube/download.rs`) e integração desktop/bandeja (`desktop.rs`).

## Contribuição

Contribuições são bem-vindas! Leia [CONTRIBUTING.md](CONTRIBUTING.md), siga o [Código de Conduta](CODE_OF_CONDUCT.md) e consulte [SECURITY.md](SECURITY.md) para relatar vulnerabilidades.

## Aviso legal e privacidade

- **Uso responsável**: o MediaKit é uma ferramenta local de conversão e download. Use o recurso de download apenas para conteúdos que você tem permissão para baixar, respeitando direitos autorais e os Termos de Serviço das plataformas.
- **Cookies de navegador**: quando necessário para acessar mídia, o `yt-dlp` pode ler cookies de navegadores instalados localmente (`--cookies-from-browser`). Esses dados permanecem exclusivamente na sua máquina e nunca são enviados a terceiros.

## Licença

Distribuído sob a licença [MIT](LICENSE). Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) para informações sobre as licenças dos binários sidecar (`FFmpeg`, `FFprobe` e `yt-dlp`).

---

## English Overview

**MediaKit** is a local-first Windows desktop application built with **Tauri 2**, **React 19**, **TypeScript**, and **Rust** for video/audio/image compression and conversion via `FFmpeg`, plus media downloading via `yt-dlp` sidecars.

- **Local execution:** Everything runs offline on your machine; no uploads or external queues.
- **Prerequisites:** Windows 10/11 (x64), Node.js 20+, Rust (`rustup`), Visual Studio C++ Build Tools, and WebView2.
- **Quick start:**
  ```powershell
  npm install
  npm run ffmpeg:download
  npm run ytdlp:download
  npm run tauri dev
  ```
- **Contributing & License:** See [CONTRIBUTING.md](CONTRIBUTING.md) and [LICENSE](LICENSE) (MIT).
