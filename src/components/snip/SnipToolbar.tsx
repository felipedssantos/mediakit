import {
  AppWindow,
  ArrowUpRight,
  Copy,
  Crop,
  Monitor,
  Save,
  Square,
  Type,
} from "lucide-react";

import { useT } from "../../hooks/useLocale";
import { isAnnotateTool, type AnnotateTool } from "../../lib/snipAnnotate";
import type { SnipMode } from "../../types/screenshot";

export type OverlayTool = SnipMode | AnnotateTool;

interface SnipToolbarProps {
  tool: OverlayTool;
  action: "copy" | "save";
  hint: string;
  error: string | null;
  onSelectCapture: (tool: SnipMode) => void;
  onSelectAnnotate: (tool: AnnotateTool) => void;
  onSelectAction: (action: "copy" | "save") => void;
}

const modeBtn =
  "ui-control inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium";

function btnClass(active: boolean) {
  return `${modeBtn} ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-transparent text-ink-2 hover:bg-elevated hover:text-ink"
  }`;
}

export function SnipToolbar({
  tool,
  action,
  hint,
  error,
  onSelectCapture,
  onSelectAnnotate,
  onSelectAction,
}: SnipToolbarProps) {
  const t = useT();
  return (
    <>
      <div
        data-snip-toolbar
        className="absolute top-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 rounded-xl border border-line bg-surface/95 p-1.5 shadow-lg backdrop-blur-xs"
      >
        <button
          type="button"
          className={btnClass(tool === "fullscreen")}
          onClick={() => onSelectCapture("fullscreen")}
        >
          <Monitor size={13} />
          {t.snip.toolFullscreen}
        </button>
        <button
          type="button"
          className={btnClass(tool === "window")}
          onClick={() => onSelectCapture("window")}
        >
          <AppWindow size={13} />
          {t.snip.toolWindow}
        </button>
        <button
          type="button"
          className={btnClass(tool === "region")}
          onClick={() => onSelectCapture("region")}
        >
          <Crop size={13} />
          {t.snip.toolRegion}
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          className={btnClass(tool === "arrow")}
          onClick={() => onSelectAnnotate("arrow")}
        >
          <ArrowUpRight size={13} />
          {t.snip.toolArrow}
        </button>
        <button
          type="button"
          className={btnClass(tool === "rect")}
          onClick={() => onSelectAnnotate("rect")}
        >
          <Square size={13} />
          {t.snip.toolRect}
        </button>
        <button
          type="button"
          className={btnClass(tool === "text")}
          onClick={() => onSelectAnnotate("text")}
        >
          <Type size={13} />
          {t.snip.toolText}
        </button>
        <span className="mx-1 h-4 w-px bg-line" />
        <button
          type="button"
          className={btnClass(action === "copy")}
          onClick={() => onSelectAction("copy")}
        >
          <Copy size={13} />
          {t.common.copy}
        </button>
        <button
          type="button"
          className={btnClass(action === "save")}
          onClick={() => onSelectAction("save")}
        >
          <Save size={13} />
          {t.common.save}
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface/90 px-3.5 py-1.5 text-xs font-medium text-ink shadow-md">
        {hint}
        {isAnnotateTool(tool)
          ? t.snip.footerAnnotate
          : action === "copy"
            ? t.snip.footerCopy
            : t.snip.footerSave}
        {t.snip.footerEscape}
      </p>

      {error && (
        <p className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 rounded-lg border border-danger/25 bg-danger-soft px-3 py-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </>
  );
}
