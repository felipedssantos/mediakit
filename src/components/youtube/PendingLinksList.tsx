import { CheckCircle2, Download, Loader2, X } from "lucide-react";
import type { CSSProperties } from "react";

import type { PendingYoutube } from "../../hooks/useYoutubeForm";
import { useT } from "../../hooks/useLocale";
import { formatDuration } from "../../lib/presets";
import { StepHeader } from "../StepHeader";

interface PendingLinksListProps {
  items: PendingYoutube[];
  readyCount: number;
  onRemove: (url: string) => void;
}

export function PendingLinksList({
  items,
  readyCount,
  onRemove,
}: PendingLinksListProps) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <div>
      <StepHeader
        step={String(readyCount)}
        title={
          items.length > 1
            ? t.youtube.readyListTitle
            : t.youtube.probeStatusTitle
        }
      />
      <ul className="surface-card divide-y divide-line overflow-hidden rounded-2xl">
        {items.map((item, index) => (
          <li
            key={item.url}
            className="ui-enter flex items-start gap-3 p-3.5"
            style={
              {
                "--stagger": `${Math.min(index, 5) * 24}ms`,
              } as CSSProperties
            }
          >
            {item.video?.thumbnail ? (
              <img
                src={item.video.thumbnail}
                alt=""
                className="h-12 w-20 shrink-0 rounded-lg bg-inset object-cover ring-1 ring-line"
              />
            ) : (
              <div
                className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-line bg-inset text-ink-3"
                aria-hidden
              >
                {item.status === "probing" ? (
                  <Loader2 size={16} className="animate-spin text-accent" />
                ) : (
                  <Download size={16} />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {item.status === "probing" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-medium text-accent">
                    {t.youtube.searchingButton}
                  </span>
                )}
                {item.status === "error" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">
                    {t.common.errorStamp}
                  </span>
                )}
                {item.status === "ready" && item.video && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok">
                    <CheckCircle2 size={11} />
                    {t.youtube.readyBadge}
                  </span>
                )}
              </div>
              {item.video ? (
                <>
                  <p className="mt-1 truncate text-sm font-semibold text-ink">
                    {item.video.title}
                  </p>
                  <p className="mono-num mt-0.5 truncate text-[11px] text-ink-2">
                    {[
                      item.video.source,
                      item.video.channel,
                      formatDuration(item.video.duration),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </>
              ) : item.error ? (
                <p className="mt-1 text-xs leading-5 text-danger">
                  {item.error}
                </p>
              ) : (
                <p className="mono-num mt-1 truncate text-xs text-ink-2">
                  {item.url}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onRemove(item.url)}
              className="ui-control shrink-0 rounded-lg p-1.5 text-ink-3 hover:bg-danger-soft hover:text-danger"
              aria-label={t.youtube.removeLink}
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
