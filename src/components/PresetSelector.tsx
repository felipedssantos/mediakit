import {
  Check,
  FileAudio,
  FileImage,
  FileVideo,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useRef } from "react";

import { useT } from "../hooks/useLocale";
import { animatePop, animateStaggerIn } from "../lib/motion";
import type { PresetId } from "../lib/presets";

export interface PresetOption<T extends string> {
  id: T;
  label: string;
  bestFor: string;
  usesGpu: boolean;
  recommended?: boolean;
}

interface PresetSelectorProps<T extends string> {
  value: T;
  presets: PresetOption<T>[];
  codes?: Record<T, string>;
  nvencAvailable?: boolean;
  onChange: (id: T) => void;
}

function PresetIcon({ id, usesGpu }: { id: string; usesGpu: boolean }) {
  if (usesGpu) return <Zap size={16} />;
  if (id === "extract_audio") return <FileAudio size={16} />;
  if (
    id.startsWith("img_") ||
    id === "jpeg" ||
    id === "png" ||
    id === "webp" ||
    id === "bmp" ||
    id === "tiff"
  ) {
    return <FileImage size={16} />;
  }
  if (id.includes("compress")) return <Sparkles size={16} />;
  return <FileVideo size={16} />;
}

export function PresetSelector<T extends string>({
  value,
  presets,
  nvencAvailable = true,
  onChange,
}: PresetSelectorProps<T>) {
  const t = useT();
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = gridRef.current;
    if (!root) return;
    return animateStaggerIn(root.querySelectorAll("[data-preset-card]"), {
      y: 10,
      scale: 0.985,
      duration: 360,
      staggerMs: 30,
    });
  }, []);

  return (
    <div
      ref={gridRef}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {presets.map((preset) => {
        const disabled = preset.usesGpu && !nvencAvailable;
        const selected = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            data-preset-card
            disabled={disabled}
            aria-pressed={selected}
            onClick={(event) => {
              onChange(preset.id);
              animatePop(event.currentTarget);
            }}
            className={`ui-card relative flex min-h-30 flex-col overflow-hidden rounded-2xl p-4 text-left ${
              selected
                ? "surface-card-active"
                : "surface-card hover:border-line-strong"
            } ${
              disabled
                ? "cursor-not-allowed opacity-50 hover:transform-none hover:border-line"
                : ""
            }`}
          >
            {selected && (
              <span
                aria-hidden
                className="absolute inset-x-0 top-0 h-0.5 bg-accent"
              />
            )}

            <div className="flex w-full items-center justify-between gap-2">
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl border ${
                  selected
                    ? "border-accent/30 bg-accent text-accent-ink shadow-xs"
                    : "border-line bg-elevated text-ink-2"
                }`}
              >
                <PresetIcon id={preset.id} usesGpu={preset.usesGpu} />
              </span>

              <div className="flex items-center gap-1.5">
                {preset.recommended && !disabled && (
                  <span className="rounded-full border border-ok/25 bg-ok-soft px-2 py-0.5 text-[11px] font-semibold text-ok">
                    {t.common.recommended}
                  </span>
                )}
                {selected && (
                  <span
                    aria-hidden
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xs"
                  >
                    <Check size={12} />
                  </span>
                )}
              </div>
            </div>

            <span
              className={`mt-3 text-sm font-bold leading-5 ${
                selected ? "text-accent" : "text-ink"
              }`}
            >
              {preset.label}
            </span>
            <span className="mt-1 flex-1 text-xs leading-5 text-ink-2">
              {disabled
                ? t.outputSettings.nvidiaUnavailable
                : preset.bestFor}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function VideoPresetSelector({
  value,
  presets,
  nvencAvailable,
  onChange,
}: {
  value: PresetId;
  presets: PresetOption<PresetId>[];
  nvencAvailable: boolean;
  onChange: (id: PresetId) => void;
}) {
  return (
    <PresetSelector
      value={value}
      presets={presets}
      nvencAvailable={nvencAvailable}
      onChange={onChange}
    />
  );
}
