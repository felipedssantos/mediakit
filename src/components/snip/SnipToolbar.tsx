import {
  ArrowUpRight,
  Circle,
  Copy,
  Crop,
  Grid3x3,
  Move,
  Pencil,
  Save,
  Square,
  Type,
  Undo2,
  X,
} from "lucide-react";

import { useT } from "../../hooks/useLocale";
import { ANNOTATE_COLORS, type AnnotateTool } from "../../lib/snipAnnotate";

interface SnipToolbarProps {
  tool: AnnotateTool;
  color: string;
  canUndo: boolean;
  committing: boolean;
  error: string | null;
  style: { left: number; top: number };
  onSelectTool: (tool: AnnotateTool) => void;
  onSelectColor: (color: string) => void;
  onUndo: () => void;
  onReselect: () => void;
  onCopy: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const toolBtn =
  "ui-control inline-flex items-center gap-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors";

function btnClass(active: boolean) {
  return `${toolBtn} ${
    active
      ? "border-accent bg-accent-soft text-accent"
      : "border-transparent text-ink-2 hover:bg-elevated hover:text-ink"
  }`;
}

export function SnipToolbar({
  tool,
  color,
  canUndo,
  committing,
  error,
  style,
  onSelectTool,
  onSelectColor,
  onUndo,
  onReselect,
  onCopy,
  onSave,
  onCancel,
}: SnipToolbarProps) {
  const t = useT();

  const tools: Array<{
    id: AnnotateTool;
    label: string;
    icon: typeof Move;
    hotkey: string;
  }> = [
    { id: "select", label: t.snip.toolSelect, icon: Move, hotkey: "1" },
    { id: "pen", label: t.snip.toolPen, icon: Pencil, hotkey: "2" },
    { id: "arrow", label: t.snip.toolArrow, icon: ArrowUpRight, hotkey: "3" },
    { id: "rect", label: t.snip.toolRect, icon: Square, hotkey: "4" },
    { id: "ellipse", label: t.snip.toolEllipse, icon: Circle, hotkey: "5" },
    { id: "text", label: t.snip.toolText, icon: Type, hotkey: "6" },
    { id: "pixelate", label: t.snip.toolPixelate, icon: Grid3x3, hotkey: "7" },
  ];

  return (
    <div
      data-snip-toolbar
      style={{ left: style.left, top: style.top }}
      className="absolute z-30 flex flex-col items-start gap-1.5"
    >
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-line bg-surface/95 p-1.5 shadow-xl backdrop-blur-xs">
        {tools.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              title={`${item.label} (${item.hotkey})`}
              aria-label={item.label}
              className={btnClass(tool === item.id)}
              onClick={() => onSelectTool(item.id)}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{item.label}</span>
            </button>
          );
        })}

        <span className="mx-0.5 h-4 w-px bg-line" />

        <div className="flex items-center gap-1 px-1">
          {ANNOTATE_COLORS.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => onSelectColor(swatch)}
              className={`h-4 w-4 rounded-full border transition-transform ${
                color === swatch
                  ? "scale-115 border-ink ring-2 ring-accent/50"
                  : "border-line-strong hover:scale-110"
              }`}
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>

        <span className="mx-0.5 h-4 w-px bg-line" />

        <button
          type="button"
          title="Ctrl+Z"
          disabled={!canUndo || committing}
          onClick={onUndo}
          className={`${toolBtn} border-transparent text-ink-2 hover:bg-elevated hover:text-ink disabled:opacity-40`}
        >
          <Undo2 size={13} />
        </button>

        <button
          type="button"
          title={`${t.snip.toolReselect} (Backspace)`}
          disabled={committing}
          onClick={onReselect}
          className={`${toolBtn} border-transparent text-ink-2 hover:bg-elevated hover:text-ink disabled:opacity-40`}
        >
          <Crop size={13} />
        </button>

        <span className="mx-0.5 h-4 w-px bg-line" />

        <button
          type="button"
          disabled={committing}
          title={`${t.common.copy} (Enter)`}
          onClick={onCopy}
          className="ui-btn inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-semibold text-accent-ink hover:bg-accent-hover disabled:opacity-50"
        >
          <Copy size={13} />
          {t.common.copy}
        </button>

        <button
          type="button"
          disabled={committing}
          title={`${t.common.save} (Ctrl+S)`}
          onClick={onSave}
          className="ui-btn inline-flex items-center gap-1.5 rounded-lg border border-line-strong bg-elevated px-2.5 py-1.5 text-xs font-medium text-ink hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <Save size={13} />
          {t.common.save}
        </button>

        <button
          type="button"
          disabled={committing}
          title="Esc"
          aria-label={t.common.cancel}
          onClick={onCancel}
          className={`${toolBtn} border-transparent text-ink-2 hover:bg-danger-soft hover:text-danger disabled:opacity-40`}
        >
          <X size={13} />
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-1 text-xs font-medium text-danger shadow-md">
          {error}
        </p>
      )}
    </div>
  );
}
