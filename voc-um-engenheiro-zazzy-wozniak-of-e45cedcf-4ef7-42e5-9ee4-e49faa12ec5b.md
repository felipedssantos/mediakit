# Plano de melhorias — Conversor (Tauri 2 + React 19 + Rust)

## Contexto
O projeto será publicado como open source no GitHub. Hoje funciona, mas tem duplicação forte (fila de jobs de conversão vs. YouTube, no Rust e no React), arquivos grandes, erros como `String`, ~30 `unwrap()` em locks, CSP desativada, scripts de download sem versão nem checksum, dois lockfiles e nenhum lint, teste de frontend, CI, LICENSE ou CONTRIBUTING. Objetivo: código limpo, legível para qualquer nível, seguro e fácil de contribuir — sem mudar comportamento.

## Diagnóstico (evidências)
**Backend (`src-tauri/src`, 3523 linhas)**
- `youtube/manager.rs` ≈ cópia de `manager/queue.rs` (cancel/retry/spawn_pending/emit_jobs/now_secs/child store).
- Spawn de sidecar repetido: `worker/ffmpeg.rs:43-55`, `youtube/download.rs:79-92`, `probe/mod.rs:8-13`, `youtube/probe.rs:37-54`. Parsing de progresso dividido (`worker/ffmpeg.rs:142`, `youtube/download.rs:271`).
- `screenshot/mod.rs` 991 linhas; `presets/builder.rs` 478.
- `Result<_, String>` ~73x; ~30 `unwrap()` em `Mutex` (`manager/queue.rs`, `youtube/manager.rs`, `youtube/cookies.rs`); `static` mutável `LAST_SUCCESS` em `cookies.rs`.
- Fallback `youtube/download.rs:223-240` procura `ffmpeg*.exe` fora do sidecar.
- Testes só em builder/ffmpeg/download.
- `tauri.conf.json:43` CSP `null`; capabilities com `args: true` nos sidecars; `Cargo.toml:5` `authors = ["you"]`.

**Frontend (`src`)**
- Pares duplicados: `useJobs`/`useYoutubeJobs` (hydrate/listen/cancel), `JobCard`/`YoutubeJobCard`, `JobQueue`/`YoutubeJobQueue`, `ConverterPage`/`ImageConverterPage`, possivelmente `OutputSettings`/`ImageOutputSettings`.
- Grandes: `SnipOverlayPage.tsx` 734, `YoutubePage.tsx` 497, `ImageConverterPage.tsx` 392, `ConverterPage.tsx` 390.
- `@tauri-apps` importado direto em `TitleBar.tsx`, `ConverterPage.tsx`, `ImageConverterPage.tsx`, `SnipOverlayPage.tsx` (fora de `src/lib`).
- Literal de status `"finalizando"` comparado em `YoutubeJobCard.tsx:26` (contrato frágil com backend).
- Lixo: `src/assets/react.svg`; `react-grab` em devDeps (verificar uso).
- Feature flag `SCREENSHOT_ENABLED = false` gateando ~1000 linhas.

**Repo/tooling**
- `package-lock.json` + `pnpm-lock.yaml` juntos.
- Sem ESLint/Prettier/Vitest/rustfmt.toml/clippy em CI, sem `.github/`, LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, templates de issue/PR.
- `scripts/download-*.ps1` baixam "latest" sem checksum; `generate-app-icon.py` solto.

## Plano (fases, cada uma = 1 PR/commit pequeno, comportamento preservado)
**Fase 0 — Base de segurança:** `git init`, garantir build (`npm run build`, `cargo build`, `cargo test`) verde antes de tocar. Registrar baseline.

**Fase 1 — Higiene do repo**
- Escolher um gerenciador (recomendado: npm, remover `pnpm-lock.yaml`) e `packageManager` no `package.json`.
- Remover `src/assets/react.svg`; remover `react-grab` se não usado.
- `Cargo.toml`: `authors`, `description`, `license`, `repository`; `package.json`: `license`, `repository`.
- Adicionar LICENSE (perguntar licença; padrão MIT), CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md, `.github/ISSUE_TEMPLATE`, `PULL_REQUEST_TEMPLATE.md`, `.editorconfig`.
- README: badges, screenshots, pré-requisitos, setup, scripts, arquitetura, como contribuir. Manter PT-BR + seção resumida em EN.

**Fase 2 — Tooling de qualidade**
- ESLint flat config (typescript-eslint, react-hooks, react-refresh) + Prettier; scripts `lint`, `format`, `typecheck`.
- `rustfmt.toml`, `cargo clippy -- -D warnings` limpo.
- Vitest + Testing Library para `src/lib` (parsers: `parseYoutubeUrls`, presets).
- CI GitHub Actions (windows-latest): install, lint, typecheck, vitest, `cargo fmt --check`, `cargo clippy`, `cargo test`. Dependabot para npm e cargo.

**Fase 3 — Dependências**
- `npm outdated` / `cargo update` + `cargo outdated`; subir minors/patches; fixar `^2` do Tauri em versões explícitas alinhadas (CLI, api, plugins e crates na mesma linha 2.x).
- Scripts de download: versão fixa + verificação SHA-256; documentar.

**Fase 4 — Backend Rust**
- Criar `error.rs` com `thiserror` (`AppError` serializável para o frontend); substituir `Result<_, String>` gradualmente.
- Trocar `lock().unwrap()` por helper ou `parking_lot::Mutex` (sem poisoning).
- Extrair fila genérica: `queue/` com `JobQueue<J: QueueJob>` (trait com spawn/emit) usada por conversão e YouTube; apagar duplicação.
- Extrair `sidecar.rs` (spawn + leitura de linhas + kill) e `progress.rs` (parsers) usados por ffmpeg, probe e yt-dlp.
- Dividir `screenshot/mod.rs` em `capture.rs`, `region.rs`, `windows.rs`, `clipboard.rs`, `commands.rs`; `presets/builder.rs` em vídeo/imagem.
- `LAST_SUCCESS` → estado gerenciado (`tauri::State`) ou `OnceLock<Mutex<…>>`.
- Revisar fallback de ffmpeg em `download.rs:223-240` (usar só o sidecar ou documentar).
- Status como enum serializado (`serde(rename_all)`), espelhado em `src/types`.
- Testes unitários para fila (cancel/retry), parsers de progresso, probe parsing.
- Comentários: padronizar em português? Recomendado: **identificadores e comentários de código em inglês**, UI em PT-BR (mais contribuidores). Confirmar com o dono.

**Fase 5 — Segurança Tauri**
- Definir CSP restritiva em `tauri.conf.json` (`default-src 'self'; img-src 'self' asset: http://asset.localhost data: blob:; style-src 'self' 'unsafe-inline'`), testar todas as telas.
- Capabilities: trocar `args: true` por validators/listas quando viável; escopo mínimo de asset protocol.

**Fase 6 — Frontend React**
- Mover todo `invoke`/plugin para `src/lib/` (um arquivo por domínio, ex. `lib/api/jobs.ts`, `lib/api/youtube.ts`, `lib/api/window.ts`).
- Hook genérico `createJobStore`/`useJobQueueEvents(eventName, fetcher)` substituindo a duplicação de `useJobs`/`useYoutubeJobs`.
- Componentes base `JobCardShell` + `JobQueueList` (render props/children) usados pelos dois tipos.
- Quebrar páginas >300 linhas em subcomponentes + hooks (`useSnipSelection`, `useAnnotations`, `useYoutubeForm`…).
- Textos de UI em `src/i18n/pt-BR.ts` (objeto simples, sem lib) — facilita tradução futura.
- Status tipados (union de `types/job.ts`) em vez de literais.
- Manter `SCREENSHOT_ENABLED` mas documentar no README como feature experimental.

**Fase 7 — Documentação técnica**
- `docs/ARCHITECTURE.md` com diagrama (frontend → commands → manager → worker/sidecar → events).
- Rustdoc/TSDoc curtos nas APIs públicas. CHANGELOG.md (Keep a Changelog), versão 0.1.0.

## Verificação (cada fase)
- `npm run lint && npm run typecheck && npx vitest run && npm run build`
- `cd src-tauri && cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test`
- `npm run tauri dev`: smoke manual — converter vídeo, converter imagem, baixar YouTube, cancelar e reenviar job, tray/atalho global, (screenshot se habilitado).
- CI verde no GitHub antes de publicar.
