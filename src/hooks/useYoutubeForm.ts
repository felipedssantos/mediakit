import { useEffect, useMemo, useState } from "react";

import { ptBR } from "../i18n/pt-BR";
import { pickOutputDirectory } from "../lib/api/files";
import { defaultDownloadDir, probeYoutube } from "../lib/api/youtube";
import { parseYoutubeUrls } from "../lib/youtube";
import type { YoutubeDownloadOptions, YoutubeVideo } from "../types/youtube";
import { formatErrorMessage } from "./createJobQueueStore";
import { useYoutubeJobs } from "./useYoutubeJobs";

type PendingStatus = "idle" | "probing" | "ready" | "error";

export interface PendingYoutube {
  url: string;
  status: PendingStatus;
  video?: YoutubeVideo;
  error?: string;
}

export function useYoutubeForm() {
  const enqueueMany = useYoutubeJobs((state) => state.enqueueMany);

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
      setError(ptBR.youtube.errNoLinks);
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
        const message = formatErrorMessage(err);
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
      setError(ptBR.youtube.errProbeFirst);
      return;
    }
    if (!outputDir) {
      setError(ptBR.youtube.errNoDir);
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
      setError(formatErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return {
    urlText,
    setUrlText,
    pending,
    readyItems,
    urlCount,
    probing,
    busy,
    error,
    outputDir,
    mode,
    setMode,
    quality,
    setQuality,
    audioFormat,
    setAudioFormat,
    removePending,
    handleProbe,
    handlePickFolder,
    handleDownload,
  };
}
