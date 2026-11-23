import type { CSSProperties, ReactNode } from "react";

import { FlapText } from "./FlapText";
import { ProgressBar } from "./ProgressBar";
import { TONE_EDGE, TONE_TEXT, type BoardStatus } from "../lib/boardStatus";

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

/** Item da fila: título, status e progresso. */
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
      className={`board-row-in border-b border-rule px-3 py-2.5 ${
        status.tone === "running" ? "bg-flap" : ""
      }`}
      style={{ "--stagger": `${Math.min(line - 1, 5) * 28}ms` } as CSSProperties}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="cell shrink-0 text-xs text-paint-faint">
          {String(line).padStart(2, "0")}
        </span>
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 ${TONE_EDGE[status.tone]} ${
              status.tone === "running" ? "lamp-pulse" : ""
            }`}
          />
          <FlapText
            text={statusLabel ?? status.label}
            className={`text-[11px] ${TONE_TEXT[status.tone]}`}
          />
        </span>
      </div>

      <p
        className="mt-1.5 truncate text-sm font-medium text-paint"
        title={title}
      >
        {title}
      </p>
      <p className="cell mt-0.5 truncate text-[11px] text-paint-faint">
        {detail}
      </p>

      <div className="mt-2.5">
        <ProgressBar value={progress} tone={barTone} />
        <div className="cell mt-1 flex justify-between text-[11px] text-paint-faint">
          <span>{percent}%</span>
          {status.tone === "running" && speed ? <span>{speed}</span> : null}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs leading-5 text-fault">
          <span className="stamp mr-1.5 text-fault">Motivo</span>
          <span className="line-clamp-3 align-middle">{error}</span>
        </p>
      )}

      <div className="mt-2.5 flex flex-wrap gap-2">{actions}</div>
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
      className={`stamp inline-flex items-center gap-1.5 border border-steel-dim px-2 py-1 text-paint-dim ink ${
        danger
          ? "hover:border-fault hover:text-fault"
          : "hover:border-lamp hover:text-lamp"
      }`}
    >
      {children}
    </button>
  );
}
