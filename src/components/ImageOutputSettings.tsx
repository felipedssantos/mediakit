import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

import type { ImageFormat } from "../lib/imagePresets";
import { FieldHint } from "./FieldHint";

interface ImageOutputSettingsProps {
  quality: number;
  resolution: string;
  imageFormat: ImageFormat;
  showFormat?: boolean;
  maxConcurrency: number;
  outputDir: string | null;
  onQualityChange: (value: number) => void;
  onResolutionChange: (value: string) => void;
  onFormatChange: (value: ImageFormat) => void;
  onConcurrencyChange: (value: number) => void;
  onPickOutputDir: () => void;
  children?: ReactNode;
}

function qualityLabel(quality: number): string {
  if (quality >= 90) return "Alta qualidade";
  if (quality >= 75) return "Equilibrado";
  return "Arquivo menor";
}

const selectClass =
  "ink mt-1 w-full border border-steel-dim bg-flap px-2 py-1.5 text-sm text-paint outline-none focus:border-lamp";

export function ImageOutputSettings({
  quality,
  resolution,
  imageFormat,
  showFormat = true,
  maxConcurrency,
  outputDir,
  onQualityChange,
  onResolutionChange,
  onFormatChange,
  onConcurrencyChange,
  onPickOutputDir,
  children,
}: ImageOutputSettingsProps) {
  const lossless =
    imageFormat === "png" || imageFormat === "bmp" || imageFormat === "tiff";

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

          {!lossless && (
            <div>
              <label className="flex items-baseline justify-between gap-3">
                <span className="stamp text-paint-dim">Qualidade</span>
                <span className="cell text-[11px] text-lamp">
                  {quality} · {qualityLabel(quality)}
                </span>
              </label>
              <input
                type="range"
                min={50}
                max={95}
                value={quality}
                onChange={(event) =>
                  onQualityChange(Number(event.target.value))
                }
                className="mt-1.5 w-full accent-lamp"
              />
            </div>
          )}

          <div className={lossless ? "sm:col-span-2" : undefined}>
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
            <label className="stamp block text-paint-dim">Tamanho máximo</label>
            <select
              value={resolution}
              onChange={(event) => onResolutionChange(event.target.value)}
              className={selectClass}
            >
              <option value="original">Manter original</option>
              <option value="1920">Até 1920 px</option>
              <option value="1280">Até 1280 px</option>
              <option value="800">Até 800 px</option>
            </select>
          </div>

          {showFormat && (
            <div>
              <label className="stamp block text-paint-dim">Formato</label>
              <select
                value={imageFormat}
                onChange={(event) =>
                  onFormatChange(event.target.value as ImageFormat)
                }
                className={selectClass}
              >
                <option value="jpeg">JPEG (mais compatível)</option>
                <option value="webp">WebP (arquivo menor)</option>
                <option value="png">PNG (sem perda)</option>
                <option value="bmp">BMP (sem compressão)</option>
                <option value="tiff">TIFF (impressão)</option>
              </select>
            </div>
          )}

          {lossless && (
            <div className="sm:col-span-2">
              <FieldHint>
                PNG, BMP e TIFF não perdem qualidade. O arquivo pode ficar maior
                que o original, principalmente se a foto já era JPEG.
              </FieldHint>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
