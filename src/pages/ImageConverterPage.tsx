import { useCallback, useState } from "react";

import { DropZone } from "../components/DropZone";
import { ImageOutputSettings } from "../components/ImageOutputSettings";
import { PresetSelector } from "../components/PresetSelector";
import { SectionRule } from "../components/SectionRule";
import { ConverterLayout } from "../components/converter/ConverterLayout";
import { PendingFilesList } from "../components/converter/PendingFilesList";
import { useFileDrop } from "../hooks/useFileDrop";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { useMediaInfo } from "../hooks/useMediaInfo";
import { ptBR } from "../i18n/pt-BR";
import { pickImageFiles, pickOutputDirectory } from "../lib/api/files";
import { suggestOutputPath } from "../lib/api/jobs";
import {
  IMAGE_COMPRESS_PRESETS,
  IMAGE_CONVERT_PRESETS,
  IMAGE_OUTPUT_CODES,
  IMAGE_OUTPUT_FORMATS,
  IMAGE_PRESET_CODES,
  isImageCompressPreset,
  isImageConvertPreset,
  isImagePath,
  presetIdForImageFormat,
  type ImageFormat,
  type ImagePresetId,
} from "../lib/imagePresets";
import { formatBytes } from "../lib/presets";
import type { EncodeOptions } from "../types/job";

export type ImageToolMode = "compress" | "convert";

interface ImageConverterPageProps {
  mode: ImageToolMode;
  onBack: () => void;
}

function dimensionsLabel(
  width?: number | null,
  height?: number | null,
): string {
  if (!width || !height) return "—";
  return `${width}×${height}`;
}

export function ImageConverterPage({ mode, onBack }: ImageConverterPageProps) {
  const compress = mode === "compress";
  const presets = compress ? IMAGE_COMPRESS_PRESETS : IMAGE_CONVERT_PRESETS;
  const defaultPreset = (presets[0]?.id ?? "img_compress_web") as ImagePresetId;

  useJobEvents();
  const allJobs = useJobs((state) => state.jobs);
  const jobs = allJobs.filter((job) =>
    compress
      ? isImageCompressPreset(job.preset_id)
      : isImageConvertPreset(job.preset_id),
  );
  const maxConcurrency = useJobs((state) => state.maxConcurrency);
  const error = useJobs((state) => state.error);
  const enqueue = useJobs((state) => state.enqueue);
  const cancel = useJobs((state) => state.cancel);
  const retry = useJobs((state) => state.retry);
  const setConcurrency = useJobs((state) => state.setConcurrency);

  const { files, probing, addPaths, removePath, clear } = useMediaInfo();
  const [presetId, setPresetId] = useState<ImagePresetId>(defaultPreset);
  const [quality, setQuality] = useState(compress ? 75 : 85);
  const [resolution, setResolution] = useState("original");
  const [imageFormat, setImageFormat] = useState<ImageFormat>(
    compress ? "webp" : "jpeg",
  );
  const [outputDir, setOutputDir] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropError, setDropError] = useState<string | null>(null);

  const validFiles = files.filter((file) => !file.error);
  const totalBytes = validFiles.reduce(
    (sum, file) => sum + (file.info?.size ?? 0),
    0,
  );

  function handleCompressPresetChange(nextId: ImagePresetId) {
    setPresetId(nextId);
    const nextPreset = presets.find((item) => item.id === nextId);
    if (!nextPreset) return;
    if (nextPreset.defaultQuality) setQuality(nextPreset.defaultQuality);
    setImageFormat(nextPreset.format);
  }

  const addImagePaths = useCallback(
    async (paths: string[]) => {
      const images = paths.filter(isImagePath);
      const skipped = paths.length - images.length;
      if (skipped > 0 && images.length === 0) {
        setDropError(ptBR.imageConverter.noImagesRecognized);
        return;
      }
      setDropError(
        skipped > 0 ? ptBR.imageConverter.ignoredFiles(skipped) : null,
      );
      await addPaths(images);
    },
    [addPaths],
  );

  useFileDrop(addImagePaths);

  async function handleBrowse() {
    const paths = await pickImageFiles();
    await addImagePaths(paths);
  }

  async function handlePickOutputDir() {
    const directory = await pickOutputDirectory();
    if (directory) setOutputDir(directory);
  }

  async function handleStart() {
    if (validFiles.length === 0) return;

    const options: EncodeOptions = {
      preset_id: presetId,
      quality:
        imageFormat === "png" || imageFormat === "bmp" || imageFormat === "tiff"
          ? null
          : quality,
      image_format: imageFormat,
      resolution: resolution === "original" ? null : resolution,
      crf: null,
      video_codec: null,
      use_gpu: false,
    };

    setBusy(true);
    try {
      const items = await Promise.all(
        validFiles.map(async (file) => ({
          input_path: file.path,
          output_path: await suggestOutputPath(
            file.path,
            presetId,
            outputDir ?? undefined,
            imageFormat,
          ),
          options,
        })),
      );
      await enqueue(items);
      clear();
    } finally {
      setBusy(false);
    }
  }

  const startLabel = busy
    ? ptBR.common.queuing
    : validFiles.length > 1
      ? ptBR.imageConverter.startMany(validFiles.length)
      : ptBR.common.start;

  return (
    <ConverterLayout
      title={
        compress
          ? ptBR.imageConverter.compressTitle
          : ptBR.imageConverter.convertTitle
      }
      detail={
        compress
          ? ptBR.imageConverter.compressDetail
          : ptBR.imageConverter.convertDetail
      }
      error={error ?? dropError}
      onBack={onBack}
      dropSection={
        <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-0 flex-col">
            <SectionRule
              step="01"
              title={ptBR.imageConverter.stepChooseFiles}
            />
            <DropZone
              disabled={probing}
              probing={probing}
              compact={files.length > 0}
              onBrowse={() => void handleBrowse()}
              title={ptBR.imageConverter.dropTitle}
              hint={
                compress
                  ? ptBR.imageConverter.dropCompressHint
                  : ptBR.imageConverter.dropConvertHint
              }
              probingHint={ptBR.imageConverter.dropProbingHint}
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <SectionRule
              step={String(files.length).padStart(2, "0")}
              title={ptBR.imageConverter.selectedTitle}
            />
            <PendingFilesList
              files={files}
              emptyMessage={ptBR.imageConverter.noneSelected}
              validCount={validFiles.length}
              totalBytes={totalBytes}
              formatMeta={(file) =>
                `${dimensionsLabel(file.info?.video?.width, file.info?.video?.height)} · ${formatBytes(file.info?.size ?? 0)}`
              }
              onRemove={removePath}
            />
          </div>
        </section>
      }
      presetSection={
        <section className="shrink-0">
          <SectionRule
            step="02"
            title={
              compress
                ? ptBR.imageConverter.stepCompressPreset
                : ptBR.imageConverter.stepConvertPreset
            }
          />
          {compress ? (
            <PresetSelector
              value={presetId}
              presets={presets}
              codes={IMAGE_PRESET_CODES}
              onChange={handleCompressPresetChange}
            />
          ) : (
            <PresetSelector
              value={imageFormat}
              presets={IMAGE_OUTPUT_FORMATS}
              codes={IMAGE_OUTPUT_CODES}
              onChange={(format) => {
                setImageFormat(format);
                setPresetId(presetIdForImageFormat(format));
                if (format === "jpeg") setQuality(85);
                if (format === "webp") setQuality(80);
              }}
            />
          )}
        </section>
      }
      settingsSection={
        <section>
          <SectionRule step="03" title={ptBR.common.stepAdjustments} />
          <ImageOutputSettings
            quality={quality}
            resolution={resolution}
            imageFormat={imageFormat}
            showFormat={compress}
            maxConcurrency={maxConcurrency}
            outputDir={outputDir}
            onQualityChange={setQuality}
            onResolutionChange={setResolution}
            onFormatChange={setImageFormat}
            onConcurrencyChange={(value) => void setConcurrency(value)}
            onPickOutputDir={() => void handlePickOutputDir()}
          />
        </section>
      }
      busy={busy}
      canStart={validFiles.length > 0}
      startLabel={startLabel}
      startHint={ptBR.imageConverter.startHint}
      onStart={() => void handleStart()}
      queueTitle={
        compress
          ? ptBR.imageConverter.queueCompressTitle
          : ptBR.imageConverter.queueConvertTitle
      }
      queueEmpty={
        compress
          ? ptBR.imageConverter.queueCompressEmpty
          : ptBR.imageConverter.queueConvertEmpty
      }
      jobs={jobs}
      onCancel={(id) => void cancel(id)}
      onRetry={(id) => void retry(id)}
    />
  );
}
