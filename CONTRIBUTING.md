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
- **Branches:**
  - `main`: production-ready releases only (protected).
  - `develop`: integration branch for upcoming releases.
  - Topic branches from `develop` using Conventional Commit prefixes: `feat/<name>`, `fix/<name>`, `docs/<name>`, `refactor/<name>`, `test/<name>`, `chore/<name>`, `ci/<name>`, `release/<version>`.
  - `hotfix/<name>` from `main` for urgent production fixes, merged back into both `main` and `develop`.
- Keep PRs focused and small. Preserve existing behavior unless the change specifically targets a bug or an approved feature.

## Release Process & Mandatory Signing

Every production release **MUST** be cryptographically signed. The application uses Tauri's auto-updater (`@tauri-apps/plugin-updater`), which validates the signature of each update against the embedded public key before installing. Unsigned releases will fail to install on user machines.

When building releases:
1. Set the private key environment variable:
   ```powershell
   $env:TAURI_SIGNING_PRIVATE_KEY = "$env:USERPROFILE\.tauri\mediakit.key"
   ```
2. Build the signed bundles:
   ```powershell
   npm run tauri build
   ```
3. Upload all generated artifacts to the GitHub Release:
   - Operating system installers (`MediaKit_<version>_x64-setup.exe`, `.deb`, `.AppImage`)
   - Signature files (`.sig`)
   - The `latest.json` updater manifest


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
