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

import { ptBR } from "../../i18n/pt-BR";
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

const modeBtn = "stamp inline-flex items-center gap-1.5 border px-2.5 py-1.5";

function btnClass(active: boolean) {
  return `${modeBtn} ${active ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`;
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
  return (
    <>
      <div
        data-snip-toolbar
        className="absolute top-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 border border-rule bg-void/90 p-1"
      >
        <button
          type="button"
          className={btnClass(tool === "fullscreen")}
          onClick={() => onSelectCapture("fullscreen")}
        >
          <Monitor size={12} />
          {ptBR.snip.toolFullscreen}
        </button>
        <button
          type="button"
          className={btnClass(tool === "window")}
          onClick={() => onSelectCapture("window")}
        >
          <AppWindow size={12} />
          {ptBR.snip.toolWindow}
        </button>
        <button
          type="button"
          className={btnClass(tool === "region")}
          onClick={() => onSelectCapture("region")}
        >
          <Crop size={12} />
          {ptBR.snip.toolRegion}
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          className={btnClass(tool === "arrow")}
          onClick={() => onSelectAnnotate("arrow")}
        >
          <ArrowUpRight size={12} />
          {ptBR.snip.toolArrow}
        </button>
        <button
          type="button"
          className={btnClass(tool === "rect")}
          onClick={() => onSelectAnnotate("rect")}
        >
          <Square size={12} />
          {ptBR.snip.toolRect}
        </button>
        <button
          type="button"
          className={btnClass(tool === "text")}
          onClick={() => onSelectAnnotate("text")}
        >
          <Type size={12} />
          {ptBR.snip.toolText}
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          className={btnClass(action === "copy")}
          onClick={() => onSelectAction("copy")}
        >
          <Copy size={12} />
          {ptBR.common.copy}
        </button>
        <button
          type="button"
          className={btnClass(action === "save")}
          onClick={() => onSelectAction("save")}
        >
          <Save size={12} />
          {ptBR.common.save}
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 stamp bg-void/80 px-3 py-1.5 text-paint">
        {hint}
        {isAnnotateTool(tool)
          ? ptBR.snip.footerAnnotate
          : action === "copy"
            ? ptBR.snip.footerCopy
            : ptBR.snip.footerSave}
        {ptBR.snip.footerEscape}
      </p>

      {error && (
        <p className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 bg-void/80 px-3 py-1.5 text-sm text-fault">
          {error}
        </p>
      )}
    </>
  );
}
