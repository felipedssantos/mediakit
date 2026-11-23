# Contributing to MediaKit

Thank you for your interest in contributing to MediaKit!

## Prerequisites

- **OS:** Windows 10 or 11 (x64)
- **Node.js:** 20+ (npm is the package manager for this repository)
- **Rust:** stable toolchain via `rustup`, plus Visual Studio Build Tools (Desktop development with C++)
- **WebView2:** pre-installed on Windows 10/11

## Local Setup

1. Fork and clone the repository:
   ```powershell
   git clone https://github.com/felipedssantos/mediakit.git
   cd mediakit
   ```
2. Install JS dependencies:
   ```powershell
   npm install
   ```
3. Download the sidecar binaries (required for `tauri dev` / `tauri build`, never committed to git):
   ```powershell
   npm run ffmpeg:download
   npm run ytdlp:download
   ```
4. Start the desktop app in development mode:
   ```powershell
   npm run tauri dev
   ```

## Coding Conventions

- **UI text & Localization:** English (`en`) is the default and primary language. The app supports multiple locales (`en`, `pt-BR`, `pt-PT`, `es`, `fr`) located in `src/i18n/`. When adding or modifying UI strings, update `src/i18n/en.ts` first and supply matching keys across all supported locale files (`pt-BR.ts`, `pt-PT.ts`, `es.ts`, `fr.ts`).
- **Code identifiers, comments, commits, and technical docs:** English.
- **Commits:** Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g., `feat(youtube): ...`, `fix(queue): ...`, `refactor(rust): ...`).
- Keep PRs focused and small. Preserve existing behavior unless the change specifically targets a bug or an approved feature.

## Pull Request Checklist

Before opening a PR, make sure all checks pass:

```powershell
npm run build
cd src-tauri
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

(Additional frontend lint, typecheck, and test commands apply once configured in `package.json`.)

Please ensure:
- No binaries in `src-tauri/binaries/*.exe`, secrets, or local absolute paths are included.
- New non-trivial logic includes unit tests.
- Any new or updated UI copy is localized with English (`en`) as the base in `src/i18n/`.
