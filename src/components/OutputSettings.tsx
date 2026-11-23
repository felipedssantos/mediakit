import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

import { PRESETS, type PresetId } from "../lib/presets";
import { FieldHint } from "./FieldHint";

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
  if (crf <= 21) return "Alta qualidade";
  if (crf <= 28) return "Equilibrado";
  return "Arquivo menor";
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
          <div className="sm:col-span-2">
            <label className="stamp block text-paint-dim">
              Pasta de destino
            </label>
            <div className="mt-1 flex gap-2">
              <p className="cell min-w-0 flex-1 truncate border border-steel-dim bg-flap px-2.5 py-1.5 text-xs text-paint-dim">
                {outputDir ?? "Mesma pasta do arquivo original"}
              </p>
              <button
                type="button"
                onClick={onPickOutputDir}
                className="stamp ink inline-flex shrink-0 items-center gap-1.5 border border-steel-dim px-2.5 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
              >
                <FolderOpen size={13} />
                Escolher
              </button>
            </div>
          </div>

          {!audioOnly && (
            <>
              <div>
                <label className="flex items-baseline justify-between gap-3">
                  <span className="stamp text-paint-dim">Qualidade</span>
                  <span className="cell text-[11px] text-lamp">
                    {crf} · {qualityLabel(crf)}
                  </span>
                </label>
                <input
                  type="range"
                  min={18}
                  max={35}
                  value={crf}
                  onChange={(event) => onCrfChange(Number(event.target.value))}
                  className="mt-1.5 w-full accent-lamp"
                />
              </div>

              <div>
                <label className="flex items-baseline justify-between gap-3">
                  <span className="stamp text-paint-dim">Ao mesmo tempo</span>
                  <span className="cell text-[11px] text-lamp">
                    {maxConcurrency}
                  </span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4}
                  value={maxConcurrency}
                  onChange={(event) =>
                    onConcurrencyChange(Number(event.target.value))
                  }
                  className="mt-1.5 w-full accent-lamp"
                />
              </div>

              <div>
                <label className="stamp block text-paint-dim">Resolução</label>
                <select
                  value={resolution}
                  onChange={(event) => onResolutionChange(event.target.value)}
                  className={selectClass}
                >
                  <option value="original">Manter original</option>
                  <option value="1080p">1080p (Full HD)</option>
                  <option value="720p">720p (HD)</option>
                  <option value="480p">480p (menor arquivo)</option>
                </select>
              </div>

              <div>
                <label className="stamp block text-paint-dim">Codec</label>
                {fixedCodec ? (
                  <p className="mt-1 border border-steel-dim bg-flap px-2 py-1.5 text-sm text-paint-dim">
                    {container === "webm"
                      ? "VP9 + Opus, exigido pelo WebM"
                      : "MPEG-4 + MP3, exigido pelo AVI"}
                  </p>
                ) : (
                  <select
                    value={videoCodec}
                    onChange={(event) => onVideoCodecChange(event.target.value)}
                    className={selectClass}
                  >
                    <option value="h264">H.264 (mais compatível)</option>
                    <option value="hevc">H.265 (arquivo menor)</option>
                  </select>
                )}
              </div>

              <label className="flex items-center justify-between gap-3 border border-rule bg-flap px-2.5 py-2 sm:col-span-2">
                <span className="min-w-0">
                  <span className="stamp block text-paint-dim">
                    Placa NVIDIA
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-paint-faint">
                    {!gpuAllowed
                      ? "Este tipo de arquivo não usa a placa NVIDIA."
                      : nvencAvailable
                        ? gpuLocked
                          ? "Este preset já usa a GPU."
                          : "Converte mais rápido com a placa de vídeo."
                        : "Nenhuma NVIDIA compatível neste computador."}
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
          )}

          {audioOnly && (
            <div className="sm:col-span-2">
              <label className="flex items-baseline justify-between gap-3">
                <span className="stamp text-paint-dim">Ao mesmo tempo</span>
                <span className="cell text-[11px] text-lamp">
                  {maxConcurrency}
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={4}
                value={maxConcurrency}
                onChange={(event) =>
                  onConcurrencyChange(Number(event.target.value))
                }
                className="mt-1.5 w-full accent-lamp"
              />
              <FieldHint>
                Números maiores terminam a fila mais rápido, mas deixam o
                computador mais ocupado.
              </FieldHint>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
