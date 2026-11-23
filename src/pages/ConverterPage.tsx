import { useState } from "react";

import { DropZone } from "../components/DropZone";
import { OutputSettings } from "../components/OutputSettings";
import {
  PresetSelector,
  VideoPresetSelector,
} from "../components/PresetSelector";
import { SectionRule } from "../components/SectionRule";
import { ConverterLayout } from "../components/converter/ConverterLayout";
import { PendingFilesList } from "../components/converter/PendingFilesList";
import { useFileDrop } from "../hooks/useFileDrop";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { useMediaInfo } from "../hooks/useMediaInfo";
import { ptBR } from "../i18n/pt-BR";
import { pickOutputDirectory, pickVideoFiles } from "../lib/api/files";
import { suggestOutputPath } from "../lib/api/jobs";
import {
  AUDIO_OUTPUT_CODES,
  AUDIO_OUTPUT_FORMATS,
  VIDEO_COMPRESS_PRESETS,
  VIDEO_CONVERT_PRESETS,
  VIDEO_OUTPUT_CODES,
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
  const compress = mode === "compress";
  const presets = compress ? VIDEO_COMPRESS_PRESETS : VIDEO_CONVERT_PRESETS;
  const defaultPreset = (presets[0]?.id ?? "compress_web") as PresetId;

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
  const [crf, setCrf] = useState(28);
  const [resolution, setResolution] = useState("original");
  const [videoCodec, setVideoCodec] = useState("h264");
  const [useGpu, setUseGpu] = useState(false);
  const [videoContainer, setVideoContainer] = useState<VideoContainer>("mp4");
  const [audioContainer, setAudioContainer] = useState<AudioContainer>("m4a");
  const [outputDir, setOutputDir] = useState<string | null>(null);
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
    ? ptBR.common.queuing
    : validFiles.length > 1
      ? ptBR.converter.startMany(validFiles.length)
      : ptBR.common.start;

  return (
    <ConverterLayout
      title={
        compress
          ? ptBR.converter.compressTitle
          : ptBR.converter.convertTitle
      }
      detail={
        compress
          ? ptBR.converter.compressDetail
          : ptBR.converter.convertDetail
      }
      error={error}
      onBack={onBack}
      dropSection={
        <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="flex min-h-0 flex-col">
            <SectionRule step="01" title={ptBR.converter.stepChooseFiles} />
            <DropZone
              disabled={probing}
              probing={probing}
              compact={files.length > 0}
              onBrowse={() => void handleBrowse()}
              title={ptBR.converter.dropTitle}
              hint={
                compress
                  ? ptBR.converter.dropCompressHint
                  : ptBR.converter.dropConvertHint
              }
            />
          </div>

          <div className="flex min-h-0 flex-col">
            <SectionRule
              step={String(files.length).padStart(2, "0")}
              title={ptBR.converter.selectedTitle}
            />
            <PendingFilesList
              files={files}
              emptyMessage={ptBR.converter.noneSelected}
              validCount={validFiles.length}
              totalBytes={totalBytes}
              formatMeta={(file) =>
                `${formatDuration(file.info?.duration ?? 0)} · ${formatBytes(file.info?.size ?? 0)}`
              }
              onRemove={removePath}
            />
          </div>
        </section>
      }
      presetSection={
        <section className="shrink-0">
          <SectionRule step="02" title={ptBR.converter.stepPreset} />
          <VideoPresetSelector
            value={presetId}
            presets={presets}
            nvencAvailable={nvenc}
            onChange={handlePresetChange}
          />
          {!compress && (
            <div className="mt-4">
              <p className="stamp mb-2 text-paint-dim">
                {presetId === "extract_audio"
                  ? ptBR.converter.saveAudioAs
                  : ptBR.converter.convertTo}
              </p>
              {presetId === "extract_audio" ? (
                <PresetSelector
                  value={audioContainer}
                  presets={AUDIO_OUTPUT_FORMATS}
                  codes={AUDIO_OUTPUT_CODES}
                  onChange={setAudioContainer}
                />
              ) : (
                <PresetSelector
                  value={videoContainer}
                  presets={VIDEO_OUTPUT_FORMATS}
                  codes={VIDEO_OUTPUT_CODES}
                  onChange={setVideoContainer}
                />
              )}
            </div>
          )}
        </section>
      }
      settingsSection={
        <section>
          <SectionRule step="03" title={ptBR.common.stepAdjustments} />
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
      startHint={ptBR.converter.startHint}
      onStart={() => void handleStart()}
      queueTitle={
        compress
          ? ptBR.converter.queueCompressTitle
          : ptBR.converter.queueConvertTitle
      }
      queueEmpty={
        compress
          ? ptBR.converter.queueCompressEmpty
          : ptBR.converter.queueConvertEmpty
      }
      jobs={jobs}
      onCancel={(id) => void cancel(id)}
      onRetry={(id) => void retry(id)}
    />
  );
}
