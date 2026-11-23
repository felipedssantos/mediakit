import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { PlayCircle, X } from "lucide-react";

import { BoardHeader } from "../components/BoardHeader";
import { BoardWait } from "../components/BoardWait";
import { DropZone } from "../components/DropZone";
import { FieldHint } from "../components/FieldHint";
import { ImageOutputSettings } from "../components/ImageOutputSettings";
import { JobQueue } from "../components/JobQueue";
import { PresetSelector } from "../components/PresetSelector";
import { useJobEvents, useJobs } from "../hooks/useJobs";
import { useMediaInfo } from "../hooks/useMediaInfo";
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
import {
  pickImageFiles,
  pickOutputDirectory,
  suggestOutputPath,
} from "../lib/tauri";
import type { EncodeOptions } from "../types/job";

export type ImageToolMode = "compress" | "convert";

interface ImageConverterPageProps {
  mode: ImageToolMode;
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
    if (!compress) return;
    if (preset.defaultQuality) setQuality(preset.defaultQuality);
    setImageFormat(preset.format);
  }, [preset, compress]);

  const addImagePaths = useCallback(
    async (paths: string[]) => {
      const images = paths.filter(isImagePath);
      const skipped = paths.length - images.length;
      if (skipped > 0 && images.length === 0) {
        setDropError(
          "Nenhuma imagem reconhecida. Use JPG, PNG, WebP, GIF, BMP, TIFF, HEIC ou AVIF.",
        );
        return;
      }
      setDropError(
        skipped > 0
          ? `${skipped} arquivo${skipped === 1 ? "" : "s"} ignorado${skipped === 1 ? "" : "s"} — só imagens entram nesta fila.`
          : null,
      );
      await addPaths(images);
    },
    [addPaths],
  );

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void getCurrentWebview()
      .onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          void addImagePaths(event.payload.paths);
        }
      })
      .then((fn) => {
        unlisten = fn;
      });
    return () => unlisten?.();
  }, [addImagePaths]);

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

  return (
    <main className="board-shutter flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader
        title={compress ? "Comprimir imagens" : "Converter imagens"}
        detail={
          compress
            ? "Escolha as fotos, o preset e despache a fila"
            : "Troque o formato para JPEG, PNG ou WebP"
        }
        onBack={onBack}
      />

      {(error || dropError) && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">Falha</span>
          {error ?? dropError}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-5">
              <section className="grid shrink-0 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
                <div className="flex min-h-0 flex-col">
                  <SectionRule step="01" title="Escolha as imagens" />
                  <DropZone
                    disabled={probing}
                    probing={probing}
                    compact={files.length > 0}
                    onBrowse={() => void handleBrowse()}
                    title="Arraste suas imagens para cá"
                    hint={
                      compress
                        ? "JPG, PNG, WebP, GIF, BMP, TIFF, HEIC e AVIF. Ou clique para escolher o que comprimir."
                        : "JPG, PNG, WebP, GIF, BMP, TIFF, HEIC e AVIF. Ou clique para escolher o que converter."
                    }
                    probingHint="A placa está conferindo tamanho e dimensões de cada imagem."
                  />
                </div>

                <div className="flex min-h-0 flex-col">
                  <SectionRule
                    step={String(files.length).padStart(2, "0")}
                    title="Imagens escolhidas"
                  />
                  {files.length === 0 ? (
                    <div className="flex flex-1 items-center border border-dashed border-steel-dim px-3 py-5 text-sm text-paint-faint">
                      Nenhuma imagem escolhida ainda.
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
                                    : `${dimensionsLabel(file.info?.video?.width, file.info?.video?.height)} · ${formatBytes(file.info?.size ?? 0)}`}
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
                <SectionRule
                  step="02"
                  title={compress ? "O que você quer fazer?" : "Converter para"}
                />
                {compress ? (
                  <PresetSelector
                    value={presetId}
                    presets={presets}
                    codes={IMAGE_PRESET_CODES}
                    onChange={setPresetId}
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

              <section>
                <SectionRule step="03" title="Ajustes (opcional)" />
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
                  ? `Iniciar ${validFiles.length} imagens`
                  : "Iniciar"}
            </button>
            {validFiles.length === 0 && (
              <FieldHint>
                Escolha as imagens acima. O botão libera quando pelo menos um
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
                ? "Assim que você iniciar a compressão, cada imagem aparece aqui com o progresso ao vivo."
                : "Assim que você iniciar a conversão, cada imagem aparece aqui com o progresso ao vivo."
            }
          />
        </aside>
      </div>
    </main>
  );
}
