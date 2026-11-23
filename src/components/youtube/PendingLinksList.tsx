import type { CSSProperties } from "react";
import { Download, X } from "lucide-react";

import type { PendingYoutube } from "../../hooks/useYoutubeForm";
import { ptBR } from "../../i18n/pt-BR";
import { formatDuration } from "../../lib/presets";
import { BoardWait } from "../BoardWait";
import { SectionRule } from "../SectionRule";

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
  if (items.length === 0) return null;

  return (
    <div>
      <SectionRule
        step={String(readyCount).padStart(2, "0")}
        title={
          items.length > 1
            ? ptBR.youtube.readyListTitle
            : ptBR.youtube.probeStatusTitle
        }
      />
      <ul className="border border-rule">
        {items.map((item, index) => (
          <li
            key={item.url}
            className={`board-row-in flex items-start gap-2.5 px-2.5 py-2 ${
              index > 0 ? "border-t border-rule" : ""
            }`}
            style={
              {
                "--stagger": `${Math.min(index, 5) * 28}ms`,
              } as CSSProperties
            }
          >
            {item.video?.thumbnail ? (
              <img
                src={item.video.thumbnail}
                alt=""
                className="h-9 w-16 shrink-0 bg-void object-cover"
              />
            ) : (
              <div
                className="flex h-9 w-16 shrink-0 items-center justify-center border border-steel-dim bg-flap text-paint-faint"
                aria-hidden
              >
                {item.status === "probing" ? (
                  <BoardWait compact label={ptBR.youtube.searching} />
                ) : (
                  <Download size={14} />
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="cell shrink-0 text-[11px] text-paint-faint">
                  {String(index + 1).padStart(2, "0")}
                </span>
                {item.status === "probing" && (
                  <span className="stamp lamp-pulse text-lamp">
                    {ptBR.youtube.searchingButton}
                  </span>
                )}
                {item.status === "error" && (
                  <span className="stamp text-fault">
                    {ptBR.common.errorStamp}
                  </span>
                )}
                {item.status === "ready" && item.video && (
                  <span className="stamp text-cleared">
                    {ptBR.youtube.readyBadge}
                  </span>
                )}
              </div>
              {item.video ? (
                <>
                  <p className="mt-0.5 truncate text-sm text-paint">
                    {item.video.title}
                  </p>
                  <p className="cell mt-0.5 truncate text-[11px] text-paint-faint">
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
                <p className="mt-0.5 text-xs leading-5 text-fault">
                  {item.error}
                </p>
              ) : (
                <p className="cell mt-0.5 truncate text-[11px] text-paint-faint">
                  {item.url}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => onRemove(item.url)}
              className="ink shrink-0 p-1 text-paint-faint hover:text-fault"
              aria-label={ptBR.youtube.removeLink}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
