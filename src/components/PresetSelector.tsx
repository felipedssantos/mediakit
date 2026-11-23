import type { CSSProperties } from "react";

import type { PresetId } from "../lib/presets";

const VIDEO_CODES: Record<PresetId, string> = {
  compress_web: "C1",
  compress_quality: "C2",
  convert_mp4: "M4",
  extract_audio: "AU",
  gpu_nvenc: "GP",
};

export interface PresetOption<T extends string> {
  id: T;
  label: string;
  bestFor: string;
  usesGpu: boolean;
}

interface PresetSelectorProps<T extends string> {
  value: T;
  presets: PresetOption<T>[];
  codes: Record<T, string>;
  nvencAvailable?: boolean;
  onChange: (id: T) => void;
}

export function PresetSelector<T extends string>({
  value,
  presets,
  codes,
  nvencAvailable = true,
  onChange,
}: PresetSelectorProps<T>) {
  return (
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
      {presets.map((preset, index) => {
        const disabled = preset.usesGpu && !nvencAvailable;
        const selected = value === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(preset.id)}
            className={`board-row-in ink flex min-h-28 flex-col border p-3 text-left ${
              selected
                ? "border-lamp bg-flap-top"
                : "border-rule bg-flap hover:border-lamp hover:bg-flap-top"
            } ${
              disabled
                ? "cursor-not-allowed opacity-40 hover:border-rule hover:bg-flap"
                : ""
            }`}
            style={{ "--stagger": `${index * 28}ms` } as CSSProperties}
          >
            <span
              className={`cell w-fit border px-1.5 py-0.5 text-xs ${
                selected
                  ? "border-lamp text-lamp"
                  : "border-steel-dim text-paint-faint"
              }`}
            >
              {codes[preset.id]}
            </span>
            <span
              className={`mt-2 text-sm font-semibold leading-5 ${
                selected ? "text-lamp" : "text-paint"
              }`}
            >
              {preset.label}
            </span>
            <span className="mt-1.5 flex-1 text-xs leading-5 text-paint-faint">
              {disabled
                ? "Placa NVIDIA não encontrada neste computador."
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
      codes={VIDEO_CODES}
      nvencAvailable={nvencAvailable}
      onChange={onChange}
    />
  );
}
