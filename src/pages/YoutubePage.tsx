import { ClipboardPaste, Download, Loader2, Search } from "lucide-react";
import { useEffect, useRef } from "react";

import { ErrorBanner } from "../components/ErrorBanner";
import { FieldHint } from "../components/FieldHint";
import { QueueSidebar } from "../components/QueueSidebar";
import { StepHeader } from "../components/StepHeader";
import { StepProgressBar } from "../components/StepProgressBar";
import { YoutubeJobQueue } from "../components/YoutubeJobQueue";
import { PendingLinksList } from "../components/youtube/PendingLinksList";
import { YoutubeDownloadOptionsPanel } from "../components/youtube/YoutubeDownloadOptionsPanel";
import { useT } from "../hooks/useLocale";
import { useYoutubeForm } from "../hooks/useYoutubeForm";
import { useYoutubeJobEvents, useYoutubeJobs } from "../hooks/useYoutubeJobs";
import { animatePageEnter } from "../lib/motion";

export function YoutubePage() {
  const t = useT();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => animatePageEnter(mainRef.current), []);

  useYoutubeJobEvents();
  const jobs = useYoutubeJobs((state) => state.jobs);
  const queueError = useYoutubeJobs((state) => state.error);
  const cancel = useYoutubeJobs((state) => state.cancel);
  const retry = useYoutubeJobs((state) => state.retry);

  const form = useYoutubeForm();

  async function handlePaste() {
    try {
      const clip = await navigator.clipboard.readText();
      if (!clip.trim()) return;
      form.setUrlText((prev) =>
        prev.trim() ? `${prev.trimEnd()}\n${clip.trim()}` : clip.trim(),
      );
    } catch {
      // Clipboard access may be blocked; user can paste directly with Ctrl+V.
    }
  }

  const downloadLabel = form.busy
    ? t.common.queuing
    : form.readyItems.length > 1
      ? t.youtube.downloadMany(form.readyItems.length)
      : t.youtube.downloadSingle;

  return (
    <main
      ref={mainRef}
      className="bg-studio-canvas flex h-full min-h-0 flex-col text-ink"
    >
      <header className="shrink-0 border-b border-line bg-surface px-6 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-ink">
              {t.youtube.title}
            </h1>
            <p className="mt-0.5 text-sm text-ink-2">{t.youtube.detail}</p>
          </div>

          <StepProgressBar
            ariaLabel={t.youtube.stepsAriaLabel}
            steps={[
              t.youtube.stepLinksLabel,
              t.youtube.stepFormatLabel,
              t.youtube.stepDownloadLabel,
            ]}
            firstStepDone={form.readyItems.length > 0}
          />
        </div>
      </header>

      <ErrorBanner message={form.error ?? queueError} />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(310px,36%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            <div className="mx-auto flex max-w-4xl flex-col gap-6">
              <section>
                <StepHeader
                  step="1"
                  title={t.youtube.stepLinks}
                  right={
                    <button
                      type="button"
                      onClick={() => void handlePaste()}
                      className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:text-accent"
                    >
                      <ClipboardPaste size={13} />
                      <span>{t.youtube.pasteClipboard}</span>
                    </button>
                  }
                />
                <div className="surface-card rounded-2xl p-3.5">
                  <textarea
                    value={form.urlText}
                    onChange={(event) => form.setUrlText(event.target.value)}
                    rows={3}
                    placeholder={t.youtube.placeholder}
                    className="mono-num w-full resize-y rounded-xl border border-line bg-inset px-3 py-2.5 text-xs leading-5 text-ink outline-none placeholder:text-ink-3 focus:border-accent"
                  />
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={form.probing || form.urlCount === 0}
                      onClick={() => void form.handleProbe()}
                      className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-3 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {form.probing ? (
                        <Loader2 size={13} className="animate-spin text-accent" />
                      ) : (
                        <Search size={13} />
                      )}
                      <span>
                        {form.probing
                          ? t.youtube.searchingButton
                          : form.urlCount > 1
                            ? t.youtube.searchMany(form.urlCount)
                            : t.youtube.searchSingle}
                      </span>
                    </button>

                    {form.urlCount > 0 && !form.probing && (
                      <span className="mono-num text-xs text-ink-2">
                        {t.youtube.linksInList(form.urlCount)}
                      </span>
                    )}
                  </div>
                </div>
                <FieldHint>{t.youtube.cookiesHint}</FieldHint>
              </section>

              <section className="flex flex-col gap-5">
                <PendingLinksList
                  items={form.pending}
                  readyCount={form.readyItems.length}
                  onRemove={form.removePending}
                />

                <YoutubeDownloadOptionsPanel
                  mode={form.mode}
                  quality={form.quality}
                  audioFormat={form.audioFormat}
                  outputDir={form.outputDir}
                  onModeChange={form.setMode}
                  onQualityChange={form.setQuality}
                  onAudioFormatChange={form.setAudioFormat}
                  onPickFolder={() => void form.handlePickFolder()}
                />
              </section>
            </div>
          </div>

          <div className="shrink-0 border-t border-line bg-surface px-6 py-3.5">
            <div className="mx-auto flex max-w-4xl flex-col gap-1.5">
              <button
                type="button"
                disabled={form.busy || form.readyItems.length === 0}
                onClick={() => void form.handleDownload()}
                className="ui-btn flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:bg-elevated disabled:text-ink-3 disabled:shadow-none"
              >
                {form.busy ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Download size={16} />
                )}
                <span>{downloadLabel}</span>
              </button>
              {form.readyItems.length === 0 && (
                <FieldHint>{t.youtube.downloadHint}</FieldHint>
              )}
            </div>
          </div>
        </div>

        <QueueSidebar title={t.youtube.queueTitle} count={jobs.length}>
          <YoutubeJobQueue
            jobs={jobs}
            onCancel={(id) => void cancel(id)}
            onRetry={(id) => void retry(id)}
          />
        </QueueSidebar>
      </div>
    </main>
  );
}
