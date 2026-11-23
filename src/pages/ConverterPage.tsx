import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { PlayCircle, X } from "lucide-react";

import { BoardHeader } from "../components/BoardHeader";
import { BoardWait } from "../components/BoardWait";
import { DropZone } from "../components/DropZone";
import { FieldHint } from "../components/FieldHint";
import { JobQueue } from "../components/JobQueue";
import { OutputSettings } from "../components/OutputSettings";
import {
  VideoPresetSelector,
  PresetSelector,
} from "../components/PresetSelector";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { useMediaInfo } from "../hooks/useMediaInfo";
import {
  pickOutputDirectory,
  pickVideoFiles,
  suggestOutputPath,
} from "../lib/tauri";
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

function SectionRule({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-2 flex h-5 shrink-0 items-center gap-2.5">
      <span className="cell shrink-0 text-xs text-paint-faint">{step}</span>
      <h2 className="stamp truncate text-paint-dim">{title}</h2>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-rule" />
    </div>
  );
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

  const preset = useMemo(
    () => presets.find((item) => item.id === presetId) ?? presets[0],
    [presetId, presets],
  );

  const validFiles = files.filter((file) => !file.error);
  const totalBytes = validFiles.reduce(
    (sum, file) => sum + (file.info?.size ?? 0),
    0,
  );

  useEffect(() => {
    if (!preset) return;
    if (preset.defaultCrf) setCrf(preset.defaultCrf);
    if (preset.videoCodec === "hevc" || preset.videoCodec === "h264") {
      setVideoCodec(preset.videoCodec);
    }
    setUseGpu(preset.usesGpu);
  }, [preset]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          void addPaths(event.payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, [addPaths]);

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

  return (
    <main className="board-shutter flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader
        title={compress ? "Comprimir vídeo" : "Converter vídeo"}
        detail={
          compress
            ? "Escolha os vídeos, o preset e despache a fila"
            : "Troque o formato ou tire só o áudio"
        }
        onBack={onBack}
      />

      {error && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">Falha</span>
          {error}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-5">
              <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="flex min-h-0 flex-col">
                  <SectionRule step="01" title="Escolha os vídeos" />
                  <DropZone
                    disabled={probing}
                    probing={probing}
                    compact={files.length > 0}
                    onBrowse={() => void handleBrowse()}
                    title="Arraste seus vídeos para cá"
                    hint={
                      compress
                        ? "Ou clique para escolher um ou vários arquivos para comprimir."
                        : "Ou clique para escolher um ou vários arquivos para converter."
                    }
                  />
                </div>

                <div className="flex min-h-0 flex-col">
                  <SectionRule
                    step={String(files.length).padStart(2, "0")}
                    title="Vídeos escolhidos"
                  />
                  {files.length === 0 ? (
                    <div className="flex flex-1 items-center border border-dashed border-steel-dim px-3 py-5 text-sm text-paint-faint">
                      Nenhum vídeo escolhido ainda.
                    </div>
                  ) : (
                    <>
                      <ul className="border border-rule">
                        {files.map((file, index) => (
                          <li
                            key={file.path}
                            className={`board-row-in flex items-center justify-between gap-3 px-2.5 py-1.5 ${
                              index > 0 ? "border-t border-rule" : ""
                            }`}
                            style={
                              {
                                "--stagger": `${Math.min(index, 5) * 28}ms`,
                              } as CSSProperties
                            }
                          >
                            <div className="flex min-w-0 items-baseline gap-2.5">
                              <span className="cell shrink-0 text-[11px] text-paint-faint">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate text-sm text-paint">
                                  {file.name}
                                </p>
                                <p className="cell truncate text-[11px] text-paint-faint">
                                  {file.error
                                    ? file.error
                                    : `${formatDuration(file.info?.duration ?? 0)} · ${formatBytes(file.info?.size ?? 0)}`}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => removePath(file.path)}
                              className="ink shrink-0 p-1 text-paint-faint hover:text-fault"
                              aria-label={`Remover ${file.name}`}
                            >
                              <X size={13} />
                            </button>
                          </li>
                        ))}
                      </ul>
                      <p className="cell mt-1.5 text-[11px] text-paint-faint">
                        {validFiles.length} arquivo
                        {validFiles.length === 1 ? "" : "s"} ·{" "}
                        {formatBytes(totalBytes)} no total
                      </p>
                    </>
                  )}
                </div>
              </section>

              <section className="shrink-0">
                <SectionRule step="02" title="O que você quer fazer?" />
                {compress ? (
                  <VideoPresetSelector
                    value={presetId}
                    presets={presets}
                    nvencAvailable={nvenc}
                    onChange={setPresetId}
                  />
                ) : (
                  <>
                    <VideoPresetSelector
                      value={presetId}
                      presets={presets}
                      nvencAvailable={nvenc}
                      onChange={setPresetId}
                    />
                    <div className="mt-4">
                      <p className="stamp mb-2 text-paint-dim">
                        {presetId === "extract_audio"
                          ? "Salvar o áudio como"
                          : "Converter para"}
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
                  </>
                )}
              </section>

              <section>
                <SectionRule step="03" title="Ajustes (opcional)" />
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
            </div>
          </div>
          <div className="shrink-0 border-t border-rule bg-void px-4 py-3">
            <button
              type="button"
              disabled={busy || validFiles.length === 0}
              onClick={() => void handleStart()}
              className="stamp ink flex w-full items-center justify-center gap-2 border border-lamp bg-lamp px-3.5 py-2.5 text-void hover:bg-void hover:text-lamp disabled:cursor-not-allowed disabled:border-steel-dim disabled:bg-transparent disabled:text-paint-faint"
            >
              {busy ? (
                <BoardWait compact label="Enfileirando" />
              ) : (
                <PlayCircle size={14} />
              )}
              {busy
                ? "Enfileirando"
                : validFiles.length > 1
                  ? `Iniciar ${validFiles.length} vídeos`
                  : "Iniciar"}
            </button>
            {validFiles.length === 0 && (
              <FieldHint>
                Escolha os vídeos acima. O botão libera quando pelo menos um
                arquivo estiver pronto.
              </FieldHint>
            )}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-rule lg:border-l lg:border-t-0">
          <div className="steel flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <h2 className="stamp text-paint">
              {compress ? "Fila de compressão" : "Fila de conversão"}
            </h2>
            <span className="cell text-xs text-paint-dim">
              {String(jobs.length).padStart(2, "0")}
            </span>
          </div>
          <JobQueue
            fill
            jobs={jobs}
            onCancel={(id) => void cancel(id)}
            onRetry={(id) => void retry(id)}
            emptyDetail={
              compress
                ? "Assim que você iniciar a compressão, cada vídeo aparece aqui com o progresso ao vivo."
                : "Assim que você iniciar a conversão, cada vídeo aparece aqui com o progresso ao vivo."
            }
          />
        </aside>
      </div>
    </main>
  );
}
