import type { ReactNode } from "react";

import { useT } from "../hooks/useLocale";
import type { Translations } from "../i18n";
import type { ImageFormat } from "../lib/imagePresets";
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

function getImageQualityTiers(t: Translations): QualityTier[] {
  return [
    {
      id: "smaller",
      label: t.qualitySimple.smaller,
      hint: t.qualitySimple.smallerHint,
      value: 65,
    },
    {
      id: "balanced",
      label: t.qualitySimple.balanced,
      hint: t.qualitySimple.balancedHint,
      value: 82,
    },
    {
      id: "high",
      label: t.qualitySimple.high,
      hint: t.qualitySimple.highHint,
      value: 93,
    },
  ];
}

function activeTierForImageQuality(quality: number): QualityTier["id"] {
  if (quality >= 90) return "high";
  if (quality >= 75) return "balanced";
  return "smaller";
}

function qualityLabel(quality: number, t: Translations): string {
  if (quality >= 90) return t.common.qualityHigh;
  if (quality >= 75) return t.common.qualityBalanced;
  return t.common.qualitySmaller;
}

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
  const t = useT();

  const lossless =
    imageFormat === "png" || imageFormat === "bmp" || imageFormat === "tiff";

  return (
    <div className="surface-card flex flex-col rounded-2xl">
      <div className="flex flex-col gap-4 p-4">
        <OutputDirField value={outputDir} onPick={onPickOutputDir} />

        {!lossless ? (
          <SimpleQualityPicker
            tiers={getImageQualityTiers(t)}
            activeId={activeTierForImageQuality(quality)}
            onSelect={onQualityChange}
          />
        ) : (
          <div className="rounded-xl border border-line bg-inset px-3.5 py-2.5">
            <FieldHint>{t.outputSettings.losslessHint}</FieldHint>
          </div>
        )}

        <AdvancedOptionsDisclosure>
          {!lossless && (
            <QualitySlider
              min={50}
              max={95}
              value={quality}
              label={qualityLabel(quality, t)}
              onChange={onQualityChange}
            />
          )}

          <ConcurrencySlider
            className={lossless ? "sm:col-span-2" : undefined}
            value={maxConcurrency}
            onChange={onConcurrencyChange}
          />

          <SelectField
            label={t.outputSettings.maxSizeLabel}
            value={resolution}
            onChange={onResolutionChange}
            options={[
              { value: "original", label: t.outputSettings.resOriginal },
              { value: "1920", label: t.outputSettings.imgMax1920 },
              { value: "1280", label: t.outputSettings.imgMax1280 },
              { value: "800", label: t.outputSettings.imgMax800 },
            ]}
          />

          {showFormat && (
            <SelectField<ImageFormat>
              label={t.outputSettings.formatLabel}
              value={imageFormat}
              onChange={onFormatChange}
              options={[
                { value: "jpeg", label: t.outputSettings.fmtJpeg },
                { value: "webp", label: t.outputSettings.fmtWebp },
                { value: "png", label: t.outputSettings.fmtPng },
                { value: "bmp", label: t.outputSettings.fmtBmp },
                { value: "tiff", label: t.outputSettings.fmtTiff },
              ]}
            />
          )}
        </AdvancedOptionsDisclosure>
      </div>
      {children}
    </div>
  );
}
