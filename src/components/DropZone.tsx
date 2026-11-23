import { Loader2, UploadCloud } from "lucide-react";
import { useRef } from "react";

import { useT } from "../hooks/useLocale";
import { animatePop } from "../lib/motion";

interface DropZoneProps {
  disabled?: boolean;
  probing?: boolean;
  onBrowse: () => void;
  compact?: boolean;
  title?: string;
  hint?: string;
  probingTitle?: string;
  probingHint?: string;
  formats?: string[];
}

export function DropZone({
  disabled,
  probing,
  onBrowse,
  compact,
  title,
  hint,
  probingTitle,
  probingHint,
  formats,
}: DropZoneProps) {
  const t = useT();
  const badgeRef = useRef<HTMLSpanElement>(null);
  const resolvedTitle = title ?? t.dropZone.defaultTitle;
  const resolvedHint = hint ?? t.dropZone.defaultHint;
  const resolvedProbingTitle = probingTitle ?? t.dropZone.probingTitle;
  const resolvedProbingHint = probingHint ?? t.dropZone.probingHint;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onBrowse}
      onMouseEnter={() => animatePop(badgeRef.current)}
      className={`bg-studio-inset ui-control group relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line-strong px-6 text-center hover:border-accent hover:bg-accent-soft/25 disabled:cursor-wait disabled:opacity-80 ${
        compact ? "min-h-30 py-4" : "min-h-40 flex-1 py-7"
      }`}
    >
      {/* Subtle studio corner brackets */}
      <span
        aria-hidden
        className="pointer-events-none absolute top-2.5 left-2.5 h-3 w-3 rounded-tl-md border-t-2 border-l-2 border-line-strong ui-control group-hover:border-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute top-2.5 right-2.5 h-3 w-3 rounded-tr-md border-t-2 border-r-2 border-line-strong ui-control group-hover:border-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-2.5 left-2.5 h-3 w-3 rounded-bl-md border-b-2 border-l-2 border-line-strong ui-control group-hover:border-accent"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute right-2.5 bottom-2.5 h-3 w-3 rounded-br-md border-r-2 border-b-2 border-line-strong ui-control group-hover:border-accent"
      />

      <span
        ref={badgeRef}
        className="surface-card flex h-12 w-12 items-center justify-center rounded-2xl text-ink-2 ui-control group-hover:border-accent/40 group-hover:text-accent"
      >
        {probing ? (
          <Loader2 size={21} className="animate-spin text-accent" />
        ) : (
          <UploadCloud size={21} />
        )}
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">
        {probing ? resolvedProbingTitle : resolvedTitle}
      </p>
      <p className="mt-1 max-w-md text-xs leading-5 text-ink-2">
        {probing ? resolvedProbingHint : resolvedHint}
      </p>

      {formats && formats.length > 0 && !probing && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
          {formats.map((fmt) => (
            <span
              key={fmt}
              className="mono-num rounded-md border border-line bg-surface px-2 py-0.5 text-[10px] font-medium text-ink-2"
            >
              {fmt}
            </span>
          ))}
        </div>
      )}
    </button>
  );
}
