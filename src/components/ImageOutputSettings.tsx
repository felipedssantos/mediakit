import type { ReactNode } from "react";

import { ptBR } from "../i18n/pt-BR";
import type { ImageFormat } from "../lib/imagePresets";
import { FieldHint } from "./FieldHint";
import { ConcurrencySlider } from "./settings/ConcurrencySlider";
import { OutputDirField } from "./settings/OutputDirField";
import { QualitySlider } from "./settings/QualitySlider";

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
  if (quality >= 90) return ptBR.common.qualityHigh;
  if (quality >= 75) return ptBR.common.qualityBalanced;
  return ptBR.common.qualitySmaller;
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
          <OutputDirField
            className="sm:col-span-2"
            value={outputDir}
            onPick={onPickOutputDir}
          />

          {!lossless && (
            <QualitySlider
              min={50}
              max={95}
              value={quality}
              label={qualityLabel(quality)}
              onChange={onQualityChange}
            />
          )}

          <ConcurrencySlider
            className={lossless ? "sm:col-span-2" : undefined}
            value={maxConcurrency}
            onChange={onConcurrencyChange}
          />

          <div>
            <label className="stamp block text-paint-dim">
              {ptBR.outputSettings.maxSizeLabel}
            </label>
            <select
              value={resolution}
              onChange={(event) => onResolutionChange(event.target.value)}
              className={selectClass}
            >
              <option value="original">
                {ptBR.outputSettings.resOriginal}
              </option>
              <option value="1920">{ptBR.outputSettings.imgMax1920}</option>
              <option value="1280">{ptBR.outputSettings.imgMax1280}</option>
              <option value="800">{ptBR.outputSettings.imgMax800}</option>
            </select>
          </div>

          {showFormat && (
            <div>
              <label className="stamp block text-paint-dim">
                {ptBR.outputSettings.formatLabel}
              </label>
              <select
                value={imageFormat}
                onChange={(event) =>
                  onFormatChange(event.target.value as ImageFormat)
                }
                className={selectClass}
              >
                <option value="jpeg">{ptBR.outputSettings.fmtJpeg}</option>
                <option value="webp">{ptBR.outputSettings.fmtWebp}</option>
                <option value="png">{ptBR.outputSettings.fmtPng}</option>
                <option value="bmp">{ptBR.outputSettings.fmtBmp}</option>
                <option value="tiff">{ptBR.outputSettings.fmtTiff}</option>
              </select>
            </div>
          )}

          {lossless && (
            <div className="sm:col-span-2">
              <FieldHint>{ptBR.outputSettings.losslessHint}</FieldHint>
            </div>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
