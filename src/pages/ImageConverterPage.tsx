import { useCallback, useState } from "react";

import { DropZone } from "../components/DropZone";
import { ImageOutputSettings } from "../components/ImageOutputSettings";
import { PresetSelector } from "../components/PresetSelector";
import { StepHeader } from "../components/StepHeader";
import { ConverterLayout } from "../components/converter/ConverterLayout";
import { PendingFilesList } from "../components/converter/PendingFilesList";
import { useAppSettings } from "../hooks/useAppSettings";
import { useFileDrop } from "../hooks/useFileDrop";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { getT, useT } from "../hooks/useLocale";
import { useMediaInfo } from "../hooks/useMediaInfo";
import { pickImageFiles, pickOutputDirectory } from "../lib/api/files";
import { suggestOutputPath } from "../lib/api/jobs";
import {
  IMAGE_COMPRESS_PRESETS,
  IMAGE_OUTPUT_FORMATS,
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
  const t = useT();
  const compress = mode === "compress";
  const presets = IMAGE_COMPRESS_PRESETS.map((item) => ({
    ...item,
    ...t.imagePresets[item.id],
  }));
  const appSettings = useAppSettings.getState();
  const initialCompressPreset =
    presets.find((item) => item.id === appSettings.imageCompressPreset) ??
    presets[0];
  const defaultPreset = (
    compress
      ? (initialCompressPreset?.id ?? "img_compress_web")
      : presetIdForImageFormat(appSettings.imageConvertFormat)
  ) as ImagePresetId;

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
  const [quality, setQuality] = useState(
    compress ? (initialCompressPreset?.defaultQuality ?? 75) : 85,
  );
  const [resolution, setResolution] = useState("original");
  const [imageFormat, setImageFormat] = useState<ImageFormat>(
    compress
      ? (initialCompressPreset?.format ?? "webp")
      : appSettings.imageConvertFormat,
  );
  const [outputDir, setOutputDir] = useState<string | null>(
    appSettings.defaultOutputDir,
  );
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
        setDropError(getT().imageConverter.noImagesRecognized);
        return;
      }
      setDropError(
        skipped > 0 ? getT().imageConverter.ignoredFiles(skipped) : null,
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
    ? t.common.queuing
    : compress
      ? validFiles.length > 1
        ? t.imageConverter.startManyCompress(validFiles.length)
        : t.imageConverter.startSingleCompress
      : validFiles.length > 1
        ? t.imageConverter.startManyConvert(validFiles.length)
        : t.imageConverter.startSingleConvert;

  const targetLabel = compress
    ? (t.imagePresets[presetId]?.label ?? "")
    : imageFormat.toUpperCase();
  const summary =
    validFiles.length > 0
      ? `${t.common.filesCount(validFiles.length)} · ${formatBytes(totalBytes)} → ${targetLabel}`
      : null;

  return (
    <ConverterLayout
      title={
        compress
          ? t.imageConverter.compressTitle
          : t.imageConverter.convertTitle
      }
      detail={
        compress
          ? t.imageConverter.compressDetail
          : t.imageConverter.convertDetail
      }
      error={error ?? dropError}
      onBack={onBack}
      dropSection={
        <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex min-h-0 flex-col">
            <StepHeader
              step="1"
              title={t.imageConverter.stepChooseFiles}
            />
            <DropZone
              disabled={probing}
              probing={probing}
              compact={files.length > 0}
              onBrowse={() => void handleBrowse()}
              title={t.imageConverter.dropTitle}
              hint={
                compress
                  ? t.imageConverter.dropCompressHint
                  : t.imageConverter.dropConvertHint
              }
              probingHint={t.imageConverter.dropProbingHint}
              formats={["JPG", "PNG", "WebP", "HEIC", "AVIF"]}
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <StepHeader
              step={String(files.length)}
              title={t.imageConverter.selectedTitle}
            />
            <PendingFilesList
              files={files}
              emptyMessage={t.imageConverter.noneSelected}
              validCount={validFiles.length}
              totalBytes={totalBytes}
              formatMeta={(file) =>
                `${dimensionsLabel(file.info?.video?.width, file.info?.video?.height)} · ${formatBytes(file.info?.size ?? 0)}`
              }
              onRemove={removePath}
              onClearAll={clear}
            />
          </div>
        </section>
      }
      presetSection={
        <section className="shrink-0">
          <StepHeader
            step="2"
            title={
              compress
                ? t.imageConverter.stepCompressPreset
                : t.imageConverter.stepConvertPreset
            }
          />
          {compress ? (
            <PresetSelector
              value={presetId}
              presets={presets}
              onChange={handleCompressPresetChange}
            />
          ) : (
            <PresetSelector
              value={imageFormat}
              presets={IMAGE_OUTPUT_FORMATS.map((item) => ({
                ...item,
                ...t.imageFormats[item.id],
              }))}
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
          <StepHeader step="3" title={t.common.stepAdjustments} />
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
      startHint={t.imageConverter.startHint}
      summary={summary}
      onStart={() => void handleStart()}
      queueTitle={
        compress
          ? t.imageConverter.queueCompressTitle
          : t.imageConverter.queueConvertTitle
      }
      queueEmpty={
        compress
          ? t.imageConverter.queueCompressEmpty
          : t.imageConverter.queueConvertEmpty
      }
      jobs={jobs}
      onCancel={(id) => void cancel(id)}
      onRetry={(id) => void retry(id)}
    />
  );
}
