import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Download, FolderOpen, Search, X } from "lucide-react";

import { BoardHeader } from "../components/BoardHeader";
import { BoardWait } from "../components/BoardWait";
import { FieldHint } from "../components/FieldHint";
import { YoutubeJobQueue } from "../components/YoutubeJobQueue";
import { useYoutubeJobEvents, useYoutubeJobs } from "../hooks/useYoutubeJobs";
import { formatDuration } from "../lib/presets";
import { pickOutputDirectory } from "../lib/tauri";
import {
  defaultDownloadDir,
  parseYoutubeUrls,
  probeYoutube,
} from "../lib/youtube";
import type { YoutubeDownloadOptions, YoutubeVideo } from "../types/youtube";

interface YoutubePageProps {
  onBack: () => void;
}

type PendingStatus = "idle" | "probing" | "ready" | "error";

interface PendingYoutube {
  url: string;
  status: PendingStatus;
  video?: YoutubeVideo;
  error?: string;
}

function SectionRule({ step, title }: { step: string; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2.5">
      <span className="cell text-xs text-paint-faint">{step}</span>
      <h2 className="stamp text-paint-dim">{title}</h2>
      <span aria-hidden className="h-px flex-1 bg-rule" />
    </div>
  );
}

const selectClass =
  "ink mt-1.5 w-full border border-steel-dim bg-flap px-2.5 py-1.5 text-sm text-paint outline-none focus:border-lamp";

export function YoutubePage({ onBack }: YoutubePageProps) {
  useYoutubeJobEvents();
  const jobs = useYoutubeJobs((state) => state.jobs);
  const queueError = useYoutubeJobs((state) => state.error);
  const enqueueMany = useYoutubeJobs((state) => state.enqueueMany);
  const cancel = useYoutubeJobs((state) => state.cancel);
  const retry = useYoutubeJobs((state) => state.retry);

  const [urlText, setUrlText] = useState("");
  const [pending, setPending] = useState<PendingYoutube[]>([]);
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState<string>("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [quality, setQuality] =
    useState<YoutubeDownloadOptions["quality"]>("best");
  const [audioFormat, setAudioFormat] =
    useState<YoutubeDownloadOptions["audio_format"]>("m4a");

  const readyItems = useMemo(
    () => pending.filter((item) => item.status === "ready" && item.video),
    [pending],
  );
  const urlCount = parseYoutubeUrls(urlText).length;

  useEffect(() => {
    void defaultDownloadDir()
      .then(setOutputDir)
      .catch(() => setOutputDir(""));
  }, []);

  function removePending(url: string) {
    setPending((items) => items.filter((item) => item.url !== url));
    setUrlText((text) =>
      text
        .split(/\r?\n/)
        .filter((line) => line.trim() !== url)
        .join("\n"),
    );
  }

  async function handleProbe() {
    const urls = parseYoutubeUrls(urlText);
    if (urls.length === 0) {
      setError("Cole um ou mais links para continuar.");
      return;
    }

    setProbing(true);
    setError(null);
    setPending(urls.map((url) => ({ url, status: "probing" as const })));

    for (const url of urls) {
      try {
        const video = await probeYoutube(url);
        setPending((items) =>
          items.map((item) =>
            item.url === url
              ? { ...item, status: "ready", video, error: undefined }
              : item,
          ),
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPending((items) =>
          items.map((item) =>
            item.url === url
              ? { ...item, status: "error", error: message, video: undefined }
              : item,
          ),
        );
      }
    }

    setProbing(false);
  }

  async function handlePickFolder() {
    const directory = await pickOutputDirectory();
    if (directory) setOutputDir(directory);
  }

  async function handleDownload() {
    if (readyItems.length === 0) {
      setError("Primeiro busque os vídeos colando os links.");
      return;
    }
    if (!outputDir) {
      setError("Escolha uma pasta para salvar os arquivos.");
      return;
    }

    const options: YoutubeDownloadOptions = {
      mode,
      quality,
      audio_format: audioFormat,
    };

    setBusy(true);
    setError(null);
    try {
      await enqueueMany(
        readyItems.map((item) => ({
          url: item.video!.url || item.url,
          title: item.video!.title,
          outputDir,
          options,
        })),
      );
      setPending([]);
      setUrlText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const downloadLabel = busy
    ? "Enfileirando"
    : readyItems.length > 1
      ? `Baixar ${readyItems.length} vídeos`
      : "Baixar";

  return (
    <main className="board-shutter flex h-full min-h-0 flex-col bg-void text-paint">
      <BoardHeader
        title="Baixar vídeo"
        detail="Cole vários links, escolha vídeo ou áudio e baixe em lote"
        onBack={onBack}
      />

      {(error || queueError) && (
        <p className="shrink-0 border-b border-rule bg-flap px-4 py-2 text-sm text-fault">
          <span className="stamp mr-2 text-fault">Falha</span>
          {error ?? queueError}
        </p>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,34%)]">
        <div className="flex min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <div className="flex flex-col gap-5">
              <section>
                <SectionRule step="01" title="Cole os links" />
                <textarea
                  value={urlText}
                  onChange={(event) => setUrlText(event.target.value)}
                  rows={4}
                  placeholder={
                    "https://www.youtube.com/watch?v=...\nhttps://vimeo.com/..."
                  }
                  className="cell w-full resize-y border border-steel-dim bg-flap px-3 py-2.5 text-sm text-paint outline-none placeholder:text-paint-faint focus:border-lamp"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={probing || urlCount === 0}
                    onClick={() => void handleProbe()}
                    className="stamp ink inline-flex items-center gap-2 border border-steel-dim px-3.5 py-2 text-paint-dim hover:border-lamp hover:text-lamp disabled:opacity-50"
                  >
                    {probing ? (
                      <BoardWait compact label="Buscando" />
                    ) : (
                      <Search size={14} />
                    )}
                    {probing
                      ? "Buscando..."
                      : urlCount > 1
                        ? `Buscar ${urlCount} links`
                        : "Buscar"}
                  </button>
                  {urlCount > 0 && !probing && (
                    <span className="cell text-xs text-paint-faint">
                      {urlCount} link{urlCount === 1 ? "" : "s"} na lista
                    </span>
                  )}
                </div>
                <FieldHint>
                  Um link por linha. Se o site pedir login, o app lê os cookies
                  do Chrome, Edge, Firefox e outros navegadores instalados —
                  entre na conta nesse navegador antes de buscar.
                </FieldHint>
              </section>

              <section className="flex flex-col gap-4">
                {pending.length > 0 && (
                  <div>
                    <SectionRule
                      step={String(readyItems.length).padStart(2, "0")}
                      title={
                        pending.length > 1
                          ? "Prontos para baixar"
                          : "Status da busca"
                      }
                    />
                    <ul className="border border-rule">
                      {pending.map((item, index) => (
                        <li
                          key={item.url}
                          className={`board-row-in flex items-start gap-2.5 px-2.5 py-2 ${
                            index > 0 ? "border-t border-rule" : ""
                          }`}
                          style={
                            {
                              "--stagger": `${Math.min(index, 5) * 28}ms`,
                            } as CSSProperties
                          }
                        >
                          {item.video?.thumbnail ? (
                            <img
                              src={item.video.thumbnail}
                              alt=""
                              className="h-9 w-16 shrink-0 bg-void object-cover"
                            />
                          ) : (
                            <div
                              className="flex h-9 w-16 shrink-0 items-center justify-center border border-steel-dim bg-flap text-paint-faint"
                              aria-hidden
                            >
                              {item.status === "probing" ? (
                                <BoardWait compact label="Buscando" />
                              ) : (
                                <Download size={14} />
                              )}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="cell shrink-0 text-[11px] text-paint-faint">
                                {String(index + 1).padStart(2, "0")}
                              </span>
                              {item.status === "probing" && (
                                <span className="stamp lamp-pulse text-lamp">
                                  Buscando...
                                </span>
                              )}
                              {item.status === "error" && (
                                <span className="stamp text-fault">Falhou</span>
                              )}
                              {item.status === "ready" && item.video && (
                                <span className="stamp text-cleared">
                                  Pronto
                                </span>
                              )}
                            </div>
                            {item.video ? (
                              <>
                                <p className="mt-0.5 truncate text-sm text-paint">
                                  {item.video.title}
                                </p>
                                <p className="cell mt-0.5 truncate text-[11px] text-paint-faint">
                                  {[
                                    item.video.source,
                                    item.video.channel,
                                    formatDuration(item.video.duration),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </>
                            ) : item.error ? (
                              <p className="mt-0.5 text-xs leading-5 text-fault">
                                {item.error}
                              </p>
                            ) : (
                              <p className="cell mt-0.5 truncate text-[11px] text-paint-faint">
                                {item.url}
                              </p>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => removePending(item.url)}
                            className="ink shrink-0 p-1 text-paint-faint hover:text-fault"
                            aria-label="Remover link"
                          >
                            <X size={13} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div>
                  <SectionRule step="02" title="Como você quer salvar?" />
                  <div className="flex flex-col border border-rule">
                    <div className="grid grid-cols-2">
                      <button
                        type="button"
                        aria-pressed={mode === "video"}
                        onClick={() => setMode("video")}
                        className={`ink border-r border-rule px-3 py-2.5 text-left ${
                          mode === "video" ? "bg-flap" : "hover:bg-flap"
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            mode === "video" ? "text-lamp" : "text-paint-dim"
                          }`}
                        >
                          Vídeo
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-paint-faint">
                          Imagem e som, pronto para assistir.
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={mode === "audio"}
                        onClick={() => setMode("audio")}
                        className={`ink px-3 py-2.5 text-left ${
                          mode === "audio" ? "bg-flap" : "hover:bg-flap"
                        }`}
                      >
                        <span
                          className={`block text-sm font-semibold ${
                            mode === "audio" ? "text-lamp" : "text-paint-dim"
                          }`}
                        >
                          Só o áudio
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-paint-faint">
                          Apenas o som, como música ou podcast.
                        </span>
                      </button>
                    </div>

                    <div className="grid gap-4 border-t border-rule px-3 py-3 sm:grid-cols-2">
                      {mode === "video" ? (
                        <div>
                          <label className="stamp block text-paint-dim">
                            Qualidade do vídeo
                          </label>
                          <select
                            value={quality}
                            onChange={(event) =>
                              setQuality(
                                event.target
                                  .value as YoutubeDownloadOptions["quality"],
                              )
                            }
                            className={selectClass}
                          >
                            <option value="best">Melhor disponível</option>
                            <option value="1080p">Até 1080p (Full HD)</option>
                            <option value="720p">Até 720p (HD)</option>
                            <option value="480p">
                              Até 480p (arquivo menor)
                            </option>
                          </select>
                          <FieldHint>
                            Qualidades menores geram arquivos menores e baixam
                            mais rápido.
                          </FieldHint>
                        </div>
                      ) : (
                        <div>
                          <label className="stamp block text-paint-dim">
                            Formato do áudio
                          </label>
                          <select
                            value={audioFormat}
                            onChange={(event) =>
                              setAudioFormat(
                                event.target
                                  .value as YoutubeDownloadOptions["audio_format"],
                              )
                            }
                            className={selectClass}
                          >
                            <option value="m4a">M4A (boa qualidade)</option>
                            <option value="mp3">
                              MP3 (abre em qualquer lugar)
                            </option>
                          </select>
                          <FieldHint>
                            Na dúvida, escolha MP3 — funciona no celular, no
                            carro e no computador.
                          </FieldHint>
                        </div>
                      )}

                      <div>
                        <label className="stamp block text-paint-dim">
                          Pasta de destino
                        </label>
                        <div className="mt-1.5 flex gap-2">
                          <p className="cell min-w-0 flex-1 truncate border border-steel-dim bg-flap px-2.5 py-1.5 text-xs text-paint-dim">
                            {outputDir || "Pasta de vídeos do Windows"}
                          </p>
                          <button
                            type="button"
                            onClick={() => void handlePickFolder()}
                            className="stamp ink inline-flex shrink-0 items-center gap-1.5 border border-steel-dim px-2.5 py-1.5 text-paint-dim hover:border-lamp hover:text-lamp"
                          >
                            <FolderOpen size={13} />
                            Escolher
                          </button>
                        </div>
                        <FieldHint>
                          Todos os arquivos do lote vão para esta pasta.
                        </FieldHint>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
          <div className="shrink-0 border-t border-rule bg-void px-4 py-3">
            <button
              type="button"
              disabled={busy || readyItems.length === 0}
              onClick={() => void handleDownload()}
              className="stamp ink flex w-full items-center justify-center gap-2 border border-lamp bg-lamp px-3.5 py-2.5 text-void hover:bg-void hover:text-lamp disabled:cursor-not-allowed disabled:border-steel-dim disabled:bg-transparent disabled:text-paint-faint"
            >
              {busy ? (
                <BoardWait compact label="Enfileirando" />
              ) : (
                <Download size={14} />
              )}
              {downloadLabel}
            </button>
            {readyItems.length === 0 && (
              <FieldHint>
                Cole os links e clique em Buscar. O botão libera quando pelo
                menos um vídeo estiver pronto.
              </FieldHint>
            )}
          </div>
        </div>

        <aside className="flex min-h-0 flex-col border-t border-rule lg:border-l lg:border-t-0">
          <div className="steel flex shrink-0 items-center justify-between gap-2 px-3 py-2">
            <h2 className="stamp text-paint">Fila de download</h2>
            <span className="cell text-xs text-paint-dim">
              {String(jobs.length).padStart(2, "0")}
            </span>
          </div>
          <YoutubeJobQueue
            jobs={jobs}
            onCancel={(id) => void cancel(id)}
            onRetry={(id) => void retry(id)}
          />
        </aside>
      </div>
    </main>
  );
}
