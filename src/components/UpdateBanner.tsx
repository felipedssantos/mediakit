import {
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ChevronDown,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useState } from "react";

import { useLocale, useT } from "../hooks/useLocale";
import { useUpdater } from "../hooks/useUpdater";
import { ProgressBar } from "./ProgressBar";

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReleaseDate(
  rawDate: string | undefined,
  locale: string,
): string | null {
  if (!rawDate) return null;
  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function UpdateBanner() {
  const t = useT();
  const locale = useLocale((state) => state.locale);
  const update = useUpdater((state) => state.update);
  const installing = useUpdater((state) => state.installing);
  const phase = useUpdater((state) => state.phase);
  const progressPercent = useUpdater((state) => state.progressPercent);
  const downloadedBytes = useUpdater((state) => state.downloadedBytes);
  const totalBytes = useUpdater((state) => state.totalBytes);
  const error = useUpdater((state) => state.error);
  const dismissed = useUpdater((state) => state.dismissed);
  const installUpdate = useUpdater((state) => state.installUpdate);
  const dismiss = useUpdater((state) => state.dismiss);

  const [notesOpen, setNotesOpen] = useState(false);

  if (!update || dismissed) {
    return null;
  }

  const releaseNotes = update.body?.trim();
  const formattedDate = formatReleaseDate(update.date, locale);
  const isInstallingPhase = phase === "installing";
  const progressValue =
    typeof progressPercent === "number"
      ? progressPercent
      : isInstallingPhase
        ? 100
        : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-line bg-canvas/95 px-4 py-2.5"
    >
      <div className="surface-card-active mx-auto max-w-6xl rounded-xl px-4 py-3 text-xs text-ink">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent">
              <Sparkles size={15} />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent-soft px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent uppercase">
                  <span className="status-pulse h-1.5 w-1.5 rounded-full bg-accent" />
                  {t.updater.badge}
                </span>

                <span className="mono-num inline-flex items-center gap-1 rounded-md border border-line bg-inset px-2 py-0.5 text-[11px] font-medium text-ink-2">
                  <span>v{update.currentVersion}</span>
                  <ArrowRight size={11} className="text-ink-3" />
                  <span className="font-semibold text-ink">
                    v{update.version}
                  </span>
                </span>

                {formattedDate && (
                  <span className="text-[11px] text-ink-3">
                    {t.updater.releasedOn(formattedDate)}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 text-[11px] text-ink-3">
                  <ShieldCheck size={12} className="text-ok" />
                  {t.updater.verifiedLabel}
                </span>
              </div>

              <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <p className="font-display text-[13px] font-semibold tracking-tight text-ink">
                  {t.updater.bannerTitle(update.version)}
                </p>
                <p className="text-xs text-ink-2">{t.updater.bannerBody}</p>
              </div>

              {installing && (
                <div className="mt-2.5 space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-medium text-ink-2">
                      {isInstallingPhase
                        ? t.updater.installing
                        : t.updater.downloading}
                    </span>
                    <span className="mono-num font-medium text-ink">
                      {totalBytes
                        ? `${formatMegabytes(downloadedBytes)} / ${formatMegabytes(totalBytes)} (${progressValue}%)`
                        : downloadedBytes > 0
                          ? formatMegabytes(downloadedBytes)
                          : `${progressValue}%`}
                    </span>
                  </div>
                  <ProgressBar
                    value={progressValue}
                    tone={isInstallingPhase ? "cleared" : "lamp"}
                    active
                  />
                </div>
              )}

              {error && !installing && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger-soft px-2.5 py-1 text-[11px] text-danger">
                  <AlertCircle size={13} className="shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {releaseNotes && notesOpen && (
                <div className="mt-2.5 rounded-lg border border-line bg-inset px-3 py-2 text-[11px] leading-relaxed whitespace-pre-wrap text-ink-2">
                  {releaseNotes}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 self-center">
            {releaseNotes && (
              <button
                type="button"
                onClick={() => setNotesOpen((prev) => !prev)}
                aria-expanded={notesOpen}
                className="ui-control inline-flex items-center gap-1 rounded-lg border border-line bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
              >
                <span>
                  {notesOpen ? t.updater.notesHide : t.updater.notesToggle}
                </span>
                <ChevronDown
                  size={13}
                  className={`transition-transform duration-150 ${notesOpen ? "rotate-180" : ""}`}
                />
              </button>
            )}

            <button
              type="button"
              disabled={installing}
              onClick={() => void installUpdate()}
              className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-accent/50 bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink shadow-sm hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {installing ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <ArrowDownToLine size={13} />
              )}
              {installing
                ? isInstallingPhase
                  ? t.updater.installingButton
                  : t.updater.downloadingButton
                : error
                  ? t.updater.retryButton
                  : t.updater.updateButton}
            </button>

            {!installing && (
              <button
                type="button"
                onClick={dismiss}
                aria-label={t.updater.dismissLabel}
                title={t.updater.dismissLabel}
                className="ui-control rounded-lg p-1.5 text-ink-3 hover:bg-elevated hover:text-ink"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
