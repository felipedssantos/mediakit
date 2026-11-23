import type { ReactNode } from "react";

import { ptBR } from "../i18n/pt-BR";
import { PRESETS, type PresetId } from "../lib/presets";
import { FieldHint } from "./FieldHint";
import { ConcurrencySlider } from "./settings/ConcurrencySlider";
import { OutputDirField } from "./settings/OutputDirField";
import { QualitySlider } from "./settings/QualitySlider";

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

function qualityLabel(crf: number): string {
  if (crf <= 21) return ptBR.common.qualityHigh;
  if (crf <= 28) return ptBR.common.qualityBalanced;
  return ptBR.common.qualitySmaller;
}

const selectClass =
  "ink mt-1 w-full border border-steel-dim bg-flap px-2 py-1.5 text-sm text-paint outline-none focus:border-lamp";

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
  const preset = PRESETS.find((item) => item.id === presetId);
  const audioOnly = presetId === "extract_audio";
  const gpuLocked = Boolean(preset?.usesGpu);
  const fixedCodec = container === "webm" || container === "avi";
  const gpuAllowed = !fixedCodec;

  return (
    <div className="flex flex-col border border-rule">
      <div className="px-3 py-2.5">
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
          <OutputDirField
            className="sm:col-span-2"
            value={outputDir}
            onPick={onPickOutputDir}
          />

          {!audioOnly ? (
            <>
              <QualitySlider
                min={18}
                max={35}
                value={crf}
                label={qualityLabel(crf)}
                onChange={onCrfChange}
              />

              <ConcurrencySlider
                value={maxConcurrency}
                onChange={onConcurrencyChange}
              />

              <div>
                <label className="stamp block text-paint-dim">
                  {ptBR.outputSettings.resolutionLabel}
                </label>
                <select
                  value={resolution}
                  onChange={(event) => onResolutionChange(event.target.value)}
                  className={selectClass}
                >
                  <option value="original">
                    {ptBR.outputSettings.resOriginal}
                  </option>
                  <option value="1080p">{ptBR.outputSettings.res1080p}</option>
                  <option value="720p">{ptBR.outputSettings.res720p}</option>
                  <option value="480p">{ptBR.outputSettings.res480p}</option>
                </select>
              </div>

              <div>
                <label className="stamp block text-paint-dim">
                  {ptBR.outputSettings.codecLabel}
                </label>
                {fixedCodec ? (
                  <p className="mt-1 border border-steel-dim bg-flap px-2 py-1.5 text-sm text-paint-dim">
                    {container === "webm"
                      ? ptBR.outputSettings.fixedCodecWebm
                      : ptBR.outputSettings.fixedCodecAvi}
                  </p>
                ) : (
                  <select
                    value={videoCodec}
                    onChange={(event) =>
                      onVideoCodecChange(event.target.value)
                    }
                    className={selectClass}
                  >
                    <option value="h264">
                      {ptBR.outputSettings.codecH264}
                    </option>
                    <option value="hevc">
                      {ptBR.outputSettings.codecHevc}
                    </option>
                  </select>
                )}
              </div>

              <label className="flex items-center justify-between gap-3 border border-rule bg-flap px-2.5 py-2 sm:col-span-2">
                <span className="min-w-0">
                  <span className="stamp block text-paint-dim">
                    {ptBR.outputSettings.nvidiaLabel}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-paint-faint">
                    {!gpuAllowed
                      ? ptBR.outputSettings.nvidiaUnsupportedFormat
                      : nvencAvailable
                        ? gpuLocked
                          ? ptBR.outputSettings.nvidiaPresetLocked
                          : ptBR.outputSettings.nvidiaAvailable
                        : ptBR.outputSettings.nvidiaUnavailable}
                  </span>
                </span>
                <input
                  type="checkbox"
                  checked={useGpu && nvencAvailable && gpuAllowed}
                  disabled={!nvencAvailable || gpuLocked || !gpuAllowed}
                  onChange={(event) => onUseGpuChange(event.target.checked)}
                  className="h-3.5 w-3.5 shrink-0 accent-lamp"
                />
              </label>
            </>
          ) : (
            <div className="sm:col-span-2">
              <ConcurrencySlider
                value={maxConcurrency}
                onChange={onConcurrencyChange}
              />
              <FieldHint>{ptBR.outputSettings.audioConcurrencyHint}</FieldHint>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
