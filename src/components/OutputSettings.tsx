import type { ReactNode } from "react";

import { useT } from "../hooks/useLocale";
import type { Translations } from "../i18n";
import { PRESETS, type PresetId } from "../lib/presets";
import { FieldHint } from "./FieldHint";
import { SelectField } from "./SelectField";
import { AdvancedOptionsDisclosure } from "./settings/AdvancedOptionsDisclosure";
import { ConcurrencySlider } from "./settings/ConcurrencySlider";
import { OutputDirField } from "./settings/OutputDirField";
import { QualitySlider } from "./settings/QualitySlider";
import {
  SimpleQualityPicker,
  type QualityTier,
} from "./settings/SimpleQualityPicker";

interface OutputSettingsProps {
  presetId: PresetId;
  crf: number;
  resolution: string;
  videoCodec: string;
  useGpu: boolean;
  nvencAvailable: boolean;
  maxConcurrency: number;
  outputDir: string | null;
  container?: string | null;
  onCrfChange: (value: number) => void;
  onResolutionChange: (value: string) => void;
  onVideoCodecChange: (value: string) => void;
  onUseGpuChange: (value: boolean) => void;
  onConcurrencyChange: (value: number) => void;
  onPickOutputDir: () => void;
  children?: ReactNode;
}

function getVideoQualityTiers(t: Translations): QualityTier[] {
  return [
    {
      id: "smaller",
      label: t.qualitySimple.smaller,
      hint: t.qualitySimple.smallerHint,
      value: 31,
    },
    {
      id: "balanced",
      label: t.qualitySimple.balanced,
      hint: t.qualitySimple.balancedHint,
      value: 26,
    },
    {
      id: "high",
      label: t.qualitySimple.high,
      hint: t.qualitySimple.highHint,
      value: 20,
    },
  ];
}

function activeTierForCrf(crf: number): QualityTier["id"] {
  if (crf <= 22) return "high";
  if (crf <= 28) return "balanced";
  return "smaller";
}

function qualityLabel(crf: number, t: Translations): string {
  if (crf <= 22) return t.common.qualityHigh;
  if (crf <= 28) return t.common.qualityBalanced;
  return t.common.qualitySmaller;
}

export function OutputSettings({
  presetId,
  crf,
  resolution,
  videoCodec,
  useGpu,
  nvencAvailable,
  maxConcurrency,
  outputDir,
  container,
  onCrfChange,
  onResolutionChange,
  onVideoCodecChange,
  onUseGpuChange,
  onConcurrencyChange,
  onPickOutputDir,
  children,
}: OutputSettingsProps) {
  const t = useT();

  const preset = PRESETS.find((item) => item.id === presetId);
  const audioOnly = presetId === "extract_audio";
  const gpuLocked = Boolean(preset?.usesGpu);
  const fixedCodec = container === "webm" || container === "avi";
  const gpuAllowed = !fixedCodec;

  return (
    <div className="surface-card flex flex-col rounded-2xl">
      <div className="flex flex-col gap-4 p-4">
        <OutputDirField value={outputDir} onPick={onPickOutputDir} />

        {!audioOnly && (
          <SimpleQualityPicker
            tiers={getVideoQualityTiers(t)}
            activeId={activeTierForCrf(crf)}
            onSelect={onCrfChange}
          />
        )}

        <AdvancedOptionsDisclosure>
          {!audioOnly ? (
            <>
              <QualitySlider
                min={18}
                max={35}
                value={crf}
                label={qualityLabel(crf, t)}
                onChange={onCrfChange}
              />

              <ConcurrencySlider
                value={maxConcurrency}
                onChange={onConcurrencyChange}
              />

              <SelectField
                label={t.outputSettings.resolutionLabel}
                value={resolution}
                onChange={onResolutionChange}
                options={[
                  { value: "original", label: t.outputSettings.resOriginal },
                  { value: "1080p", label: t.outputSettings.res1080p },
                  { value: "720p", label: t.outputSettings.res720p },
                  { value: "480p", label: t.outputSettings.res480p },
                ]}
              />

              <div>
                {fixedCodec ? (
                  <>
                    <label className="block text-xs font-medium text-ink-2">
                      {t.outputSettings.codecLabel}
                    </label>
                    <p className="mt-1.5 rounded-lg border border-line bg-inset px-3 py-2 text-xs text-ink-2">
                      {container === "webm"
                        ? t.outputSettings.fixedCodecWebm
                        : t.outputSettings.fixedCodecAvi}
                    </p>
                  </>
                ) : (
                  <SelectField
                    label={t.outputSettings.codecLabel}
                    value={videoCodec}
                    onChange={onVideoCodecChange}
                    options={[
                      { value: "h264", label: t.outputSettings.codecH264 },
                      { value: "hevc", label: t.outputSettings.codecHevc },
                    ]}
                  />
                )}
              </div>

              <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-inset px-3 py-2.5 sm:col-span-2">
                <span className="min-w-0">
                  <span className="block text-xs font-semibold text-ink">
                    {t.outputSettings.nvidiaLabel}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-ink-2">
                    {!gpuAllowed
                      ? t.outputSettings.nvidiaUnsupportedFormat
                      : nvencAvailable
                        ? gpuLocked
                          ? t.outputSettings.nvidiaPresetLocked
                          : t.outputSettings.nvidiaAvailable
                        : t.outputSettings.nvidiaUnavailable}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={useGpu && nvencAvailable && gpuAllowed}
                  disabled={!nvencAvailable || gpuLocked || !gpuAllowed}
                  onChange={(event) => onUseGpuChange(event.target.checked)}
                  className="h-4 w-4 shrink-0 accent-accent"
                />
              </label>
            </>
          ) : (
            <div className="sm:col-span-2">
              <ConcurrencySlider
                value={maxConcurrency}
                onChange={onConcurrencyChange}
              />
              <FieldHint>{t.outputSettings.audioConcurrencyHint}</FieldHint>
            </div>
          )}
        </AdvancedOptionsDisclosure>
      </div>
      {children}
    </div>
  );
}
