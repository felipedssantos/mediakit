import { Download, Search } from "lucide-react";

import { BoardHeader } from "../components/BoardHeader";
import { BoardWait } from "../components/BoardWait";
import { FieldHint } from "../components/FieldHint";
import { SectionRule } from "../components/SectionRule";
import { YoutubeJobQueue } from "../components/YoutubeJobQueue";
import { PendingLinksList } from "../components/youtube/PendingLinksList";
import { YoutubeDownloadOptionsPanel } from "../components/youtube/YoutubeDownloadOptionsPanel";
import { useYoutubeForm } from "../hooks/useYoutubeForm";
import { useYoutubeJobEvents, useYoutubeJobs } from "../hooks/useYoutubeJobs";
import { ptBR } from "../i18n/pt-BR";

interface YoutubePageProps {
  onBack: () => void;
}

export function YoutubePage({ onBack }: YoutubePageProps) {
  useYoutubeJobEvents();
  const jobs = useYoutubeJobs((state) => state.jobs);
  const queueError = useYoutubeJobs((state) => state.error);
  const cancel = useYoutubeJobs((state) => state.cancel);
  const retry = useYoutubeJobs((state) => state.retry);

  const form = useYoutubeForm();

  const downloadLabel = form.busy
    ? ptBR.common.queuing
    : form.readyItems.length > 1
      ? ptBR.youtube.downloadMany(form.readyItems.length)
      : ptBR.youtube.downloadSingle;

  return (
    <main className="board-shutter flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader
        title={ptBR.youtube.title}
        detail={ptBR.youtube.detail}
        onBack={onBack}
      />

      {(form.error || queueError) && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">
            {ptBR.common.errorStamp}
          </span>
          {form.error ?? queueError}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-5">
              <section>
                <SectionRule step="01" title={ptBR.youtube.stepLinks} />
                <textarea
                  value={form.urlText}
                  onChange={(event) => form.setUrlText(event.target.value)}
                  rows={4}
                  placeholder={ptBR.youtube.placeholder}
                  className="cell w-full resize-y border border-steel-dim bg-flap px-3 py-2.5 text-sm text-paint outline-none placeholder:text-paint-faint focus:border-lamp"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={form.probing || form.urlCount === 0}
                    onClick={() => void form.handleProbe()}
                    className="stamp ink inline-flex items-center gap-2 border border-steel-dim px-3.5 py-2 text-paint-dim hover:border-lamp hover:text-lamp disabled:opacity-50"
                  >
                    {form.probing ? (
                      <BoardWait compact label={ptBR.youtube.searching} />
                    ) : (
                      <Search size={14} />
                    )}
                    {form.probing
                      ? ptBR.youtube.searchingButton
                      : form.urlCount > 1
                        ? ptBR.youtube.searchMany(form.urlCount)
                        : ptBR.youtube.searchSingle}
                  </button>
                  {form.urlCount > 0 && !form.probing && (
                    <span className="cell text-xs text-paint-faint">
                      {ptBR.youtube.linksInList(form.urlCount)}
                    </span>
                  )}
                </div>
                <FieldHint>{ptBR.youtube.cookiesHint}</FieldHint>
              </section>

              <section className="flex flex-col gap-4">
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
          <div className="shrink-0 border-t border-rule bg-void px-4 py-3">
            <button
              type="button"
              disabled={form.busy || form.readyItems.length === 0}
              onClick={() => void form.handleDownload()}
              className="stamp ink flex w-full items-center justify-center gap-2 border border-lamp bg-lamp px-3.5 py-2.5 text-void hover:bg-void hover:text-lamp disabled:cursor-not-allowed disabled:border-steel-dim disabled:bg-transparent disabled:text-paint-faint"
            >
              {form.busy ? (
                <BoardWait compact label={ptBR.common.queuing} />
              ) : (
                <Download size={14} />
              )}
              {downloadLabel}
            </button>
            {form.readyItems.length === 0 && (
              <FieldHint>{ptBR.youtube.downloadHint}</FieldHint>
            )}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-rule lg:border-l lg:border-t-0">
          <div className="steel flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <h2 className="stamp text-paint">{ptBR.youtube.queueTitle}</h2>
            <span className="cell text-xs text-paint-dim">
              {String(jobs.length).padStart(2, "0")}
            </span>
          </div>
          <YoutubeJobQueue
            jobs={jobs}
            onCancel={(id) => void cancel(id)}
            onRetry={(id) => void retry(id)}
          />
        </aside>
      </div>
    </main>
  );
}
