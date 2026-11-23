import { useEffect, useRef, type ReactNode } from "react";

import { useT } from "../hooks/useLocale";
import {
  TONE_BADGE,
  TONE_EDGE,
  type BoardStatus,
} from "../lib/boardStatus";
import { animateStaggerIn } from "../lib/motion";
import { ProgressBar } from "./ProgressBar";

interface JobRowProps {
  line: number;
  title: string;
  detail: string;
  status: BoardStatus;
  statusLabel?: string;
  progress: number;
  speed: string | null;
  error?: string | null;
  actions: ReactNode;
}

const LEFT_ACCENT = {
  idle: "border-l-line-strong",
  running: "border-l-accent",
  cleared: "border-l-ok",
  fault: "border-l-danger",
} as const;

export function JobRow({
  line,
  title,
  detail,
  status,
  statusLabel,
  progress,
  speed,
  error,
  actions,
}: JobRowProps) {
  const t = useT();
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    return animateStaggerIn(cardRef.current, {
      y: 8,
      scale: 0.99,
      duration: 280,
      staggerMs: 0,
    });
  }, []);

  const percent =
    status.tone === "cleared" ? 100 : Math.min(99, Math.floor(progress));
  const barTone =
    status.tone === "fault"
      ? "fault"
      : status.tone === "cleared"
        ? "cleared"
        : "lamp";

  return (
    <article
      ref={cardRef}
      className={`surface-card rounded-xl border-l-2 p-3.5 ${LEFT_ACCENT[status.tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="mono-num rounded bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">
          #{String(line).padStart(2, "0")}
        </span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_BADGE[status.tone]}`}
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${TONE_EDGE[status.tone]} ${
              status.tone === "running" ? "status-pulse" : ""
            }`}
          />
          <span>{statusLabel ?? status.label}</span>
        </span>
      </div>

      <p
        className="mt-2 truncate text-sm font-semibold text-ink"
        title={title}
      >
        {title}
      </p>
      <p className="mono-num mt-0.5 truncate text-[11px] text-ink-2">
        {detail}
      </p>

      <div className="mt-3">
        <ProgressBar
          value={progress}
          tone={barTone}
          active={status.tone === "running"}
        />
        <div className="mono-num mt-1.5 flex justify-between text-[11px] font-medium text-ink-2">
          <span>{percent}%</span>
          {status.tone === "running" && speed ? (
            <span className="text-accent">{speed}</span>
          ) : null}
        </div>
      </div>

      {error && (
        <p className="mt-2.5 rounded-lg border border-danger/20 bg-danger-soft px-2.5 py-2 text-xs leading-5 text-danger">
          <span className="mr-1.5 font-semibold">
            {t.common.reasonStamp}:
          </span>
          <span className="line-clamp-3 align-middle">{error}</span>
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </article>
  );
}

export function RowAction({
  onClick,
  children,
  danger,
}: {
  onClick: () => void;
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`ui-btn inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
        danger
          ? "border-danger/25 bg-danger-soft text-danger hover:border-danger"
          : "border-line-strong bg-elevated text-ink hover:border-accent hover:text-accent"
      }`}
    >
      {children}
    </button>
  );
}
