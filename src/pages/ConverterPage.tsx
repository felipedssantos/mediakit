import { useState } from "react";

import { DropZone } from "../components/DropZone";
import { OutputSettings } from "../components/OutputSettings";
import {
  PresetSelector,
  VideoPresetSelector,
} from "../components/PresetSelector";
import { StepHeader } from "../components/StepHeader";
import { ConverterLayout } from "../components/converter/ConverterLayout";
import { PendingFilesList } from "../components/converter/PendingFilesList";
import { useAppSettings } from "../hooks/useAppSettings";
import { useFileDrop } from "../hooks/useFileDrop";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { useT } from "../hooks/useLocale";
import { useMediaInfo } from "../hooks/useMediaInfo";
import { pickOutputDirectory, pickVideoFiles } from "../lib/api/files";
import { suggestOutputPath } from "../lib/api/jobs";
import {
  AUDIO_OUTPUT_FORMATS,
  VIDEO_COMPRESS_PRESETS,
  VIDEO_CONVERT_PRESETS,
  VIDEO_OUTPUT_FORMATS,
  formatBytes,
  formatDuration,
  isVideoCompressPreset,
  isVideoConvertPreset,
  type AudioContainer,
  type PresetId,
  type VideoContainer,
} from "../lib/presets";
import type { EncodeOptions } from "../types/job";

export type ConverterMode = "compress" | "convert";

interface ConverterPageProps {
  mode: ConverterMode;
  onBack: () => void;
}

export function ConverterPage({ mode, onBack }: ConverterPageProps) {
  const t = useT();
  const compress = mode === "compress";
  const presets = (
    compress ? VIDEO_COMPRESS_PRESETS : VIDEO_CONVERT_PRESETS
  ).map((item) => ({ ...item, ...t.presets[item.id] }));
  const appSettings = useAppSettings.getState();
  const initialCompressPreset =
    presets.find((item) => item.id === appSettings.videoCompressPreset) ??
    presets[0];
  const defaultPreset = (
    compress
      ? (initialCompressPreset?.id ?? "compress_web")
      : (presets[0]?.id ?? "convert_mp4")
  ) as PresetId;
  const initialPresetObj = presets.find((item) => item.id === defaultPreset);

  useJobEvents();
  const allJobs = useJobs((state) => state.jobs);
  const jobs = allJobs.filter((job) =>
    compress
      ? isVideoCompressPreset(job.preset_id)
      : isVideoConvertPreset(job.preset_id),
  );
  const nvenc = useJobs((state) => state.nvenc);
  const maxConcurrency = useJobs((state) => state.maxConcurrency);
  const error = useJobs((state) => state.error);
  const enqueue = useJobs((state) => state.enqueue);
  const cancel = useJobs((state) => state.cancel);
  const retry = useJobs((state) => state.retry);
  const setConcurrency = useJobs((state) => state.setConcurrency);

  const { files, probing, addPaths, removePath, clear } = useMediaInfo();
  const [presetId, setPresetId] = useState<PresetId>(defaultPreset);
  const [crf, setCrf] = useState(initialPresetObj?.defaultCrf ?? 28);
  const [resolution, setResolution] = useState("original");
  const [videoCodec, setVideoCodec] = useState(
    initialPresetObj?.videoCodec === "hevc" ? "hevc" : "h264",
  );
  const [useGpu, setUseGpu] = useState(
    Boolean(initialPresetObj?.usesGpu || appSettings.preferGpu),
  );
  const [videoContainer, setVideoContainer] = useState<VideoContainer>(
    appSettings.videoConvertContainer,
  );
  const [audioContainer, setAudioContainer] = useState<AudioContainer>(
    appSettings.audioExtractContainer,
  );
  const [outputDir, setOutputDir] = useState<string | null>(
    appSettings.defaultOutputDir,
  );
  const [busy, setBusy] = useState(false);

  const validFiles = files.filter((file) => !file.error);
  const totalBytes = validFiles.reduce(
    (sum, file) => sum + (file.info?.size ?? 0),
    0,
  );

  function handlePresetChange(nextId: PresetId) {
    setPresetId(nextId);
    const nextPreset = presets.find((item) => item.id === nextId);
    if (!nextPreset) return;
    if (nextPreset.defaultCrf) setCrf(nextPreset.defaultCrf);
    if (nextPreset.videoCodec === "hevc" || nextPreset.videoCodec === "h264") {
      setVideoCodec(nextPreset.videoCodec);
    }
    setUseGpu(nextPreset.usesGpu);
  }

  useFileDrop(addPaths);

  async function handleBrowse() {
    const paths = await pickVideoFiles();
    await addPaths(paths);
  }

  async function handlePickOutputDir() {
    const directory = await pickOutputDirectory();
    if (directory) setOutputDir(directory);
  }

  async function handleStart() {
    if (validFiles.length === 0) return;

    const audioOnly = presetId === "extract_audio";
    const muxLock =
      !compress &&
      !audioOnly &&
      (videoContainer === "webm" || videoContainer === "avi");
    const container = audioOnly
      ? audioContainer
      : compress
        ? null
        : videoContainer;
    const options: EncodeOptions = {
      preset_id: presetId,
      crf: audioOnly ? null : crf,
      video_codec: audioOnly || muxLock ? null : videoCodec,
      resolution: resolution === "original" ? null : resolution,
      use_gpu: audioOnly || muxLock ? false : useGpu && nvenc,
      container,
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
            container ?? undefined,
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
        ? t.converter.startManyCompress(validFiles.length)
        : t.converter.startSingleCompress
      : validFiles.length > 1
        ? t.converter.startManyConvert(validFiles.length)
        : t.converter.startSingleConvert;

  const activePresetLabel = t.presets[presetId]?.label ?? "";
  const summary =
    validFiles.length > 0
      ? `${t.common.filesCount(validFiles.length)} · ${formatBytes(totalBytes)} → ${activePresetLabel}`
      : null;

  return (
    <ConverterLayout
      title={
        compress
          ? t.converter.compressTitle
          : t.converter.convertTitle
      }
      detail={
        compress
          ? t.converter.compressDetail
          : t.converter.convertDetail
      }
      error={error}
      onBack={onBack}
      dropSection={
        <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="flex min-h-0 flex-col">
            <StepHeader step="1" title={t.converter.stepChooseFiles} />
            <DropZone
              disabled={probing}
              probing={probing}
              compact={files.length > 0}
              onBrowse={() => void handleBrowse()}
              title={t.converter.dropTitle}
              hint={
                compress
                  ? t.converter.dropCompressHint
                  : t.converter.dropConvertHint
              }
              formats={["MP4", "MKV", "MOV", "AVI", "WebM"]}
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <StepHeader
              step={String(files.length)}
              title={t.converter.selectedTitle}
            />
            <PendingFilesList
              files={files}
              emptyMessage={t.converter.noneSelected}
              validCount={validFiles.length}
              totalBytes={totalBytes}
              formatMeta={(file) =>
                `${formatDuration(file.info?.duration ?? 0)} · ${formatBytes(file.info?.size ?? 0)}`
              }
              onRemove={removePath}
              onClearAll={clear}
            />
          </div>
        </section>
      }
      presetSection={
        <section className="shrink-0">
          <StepHeader step="2" title={t.converter.stepPreset} />
          <VideoPresetSelector
            value={presetId}
            presets={presets}
            nvencAvailable={nvenc}
            onChange={handlePresetChange}
          />
          {!compress && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold text-ink-2">
                {presetId === "extract_audio"
                  ? t.converter.saveAudioAs
                  : t.converter.convertTo}
              </p>
              {presetId === "extract_audio" ? (
                <PresetSelector
                  value={audioContainer}
                  presets={AUDIO_OUTPUT_FORMATS.map((item) => ({
                    ...item,
                    ...t.audioFormats[item.id],
                  }))}
                  onChange={setAudioContainer}
                />
              ) : (
                <PresetSelector
                  value={videoContainer}
                  presets={VIDEO_OUTPUT_FORMATS.map((item) => ({
                    ...item,
                    ...t.videoFormats[item.id],
                  }))}
                  onChange={setVideoContainer}
                />
              )}
            </div>
          )}
        </section>
      }
      settingsSection={
        <section>
          <StepHeader step="3" title={t.common.stepAdjustments} />
          <OutputSettings
            presetId={presetId}
            crf={crf}
            resolution={resolution}
            videoCodec={videoCodec}
            useGpu={useGpu}
            nvencAvailable={nvenc}
            maxConcurrency={maxConcurrency}
            outputDir={outputDir}
            container={compress ? null : videoContainer}
            onCrfChange={setCrf}
            onResolutionChange={setResolution}
            onVideoCodecChange={setVideoCodec}
            onUseGpuChange={setUseGpu}
            onConcurrencyChange={(value) => void setConcurrency(value)}
            onPickOutputDir={() => void handlePickOutputDir()}
          />
        </section>
      }
      busy={busy}
      canStart={validFiles.length > 0}
      startLabel={startLabel}
      startHint={t.converter.startHint}
      summary={summary}
      onStart={() => void handleStart()}
      queueTitle={
        compress
          ? t.converter.queueCompressTitle
          : t.converter.queueConvertTitle
      }
      queueEmpty={
        compress
          ? t.converter.queueCompressEmpty
          : t.converter.queueConvertEmpty
      }
      jobs={jobs}
      onCancel={(id) => void cancel(id)}
      onRetry={(id) => void retry(id)}
    />
  );
}
