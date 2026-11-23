import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getT } from "./useLocale";
import { pickOutputDirectory } from "../lib/api/files";
import { defaultDownloadDir, probeYoutube } from "../lib/api/youtube";
import { parseYoutubeUrls } from "../lib/youtube";
import type { YoutubeDownloadOptions, YoutubeVideo } from "../types/youtube";
import { formatErrorMessage } from "./createJobQueueStore";
import { useAppSettings } from "./useAppSettings";
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
  const appSettings = useAppSettings.getState();

  const [urlText, setUrlText] = useState("");
  const [pending, setPending] = useState<PendingYoutube[]>([]);
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputDir, setOutputDir] = useState<string>(
    appSettings.youtubeOutputDir ?? "",
  );
  const [mode, setMode] = useState<"video" | "audio">(appSettings.youtubeMode);
  const [quality, setQuality] =
    useState<YoutubeDownloadOptions["quality"]>(appSettings.youtubeQuality);
  const [audioFormat, setAudioFormat] =
    useState<YoutubeDownloadOptions["audio_format"]>(
      appSettings.youtubeAudioFormat,
    );

  const probedUrlsRef = useRef<Set<string>>(new Set());

  const readyItems = useMemo(
    () => pending.filter((item) => item.status === "ready" && item.video),
    [pending],
  );
  const urlCount = parseYoutubeUrls(urlText).length;

  useEffect(() => {
    if (appSettings.youtubeOutputDir) return;
    void defaultDownloadDir()
      .then(setOutputDir)
      .catch(() => setOutputDir(""));
  }, [appSettings.youtubeOutputDir]);

  function removePending(url: string) {
    probedUrlsRef.current.delete(url);
    setPending((items) => items.filter((item) => item.url !== url));
    setUrlText((text) =>
      text
        .split(/\r?\n/)
        .filter((line) => line.trim() !== url)
        .join("\n"),
    );
  }

  const probeUrls = useCallback(async (urls: string[], replaceAll: boolean) => {
    if (urls.length === 0) return;

    setProbing(true);
    setError(null);

    if (replaceAll) {
      probedUrlsRef.current = new Set(urls);
      setPending(urls.map((url) => ({ url, status: "probing" as const })));
    } else {
      urls.forEach((url) => probedUrlsRef.current.add(url));
      setPending((prev) => {
        const existing = new Set(prev.map((p) => p.url));
        const additions = urls
          .filter((url) => !existing.has(url))
          .map((url) => ({ url, status: "probing" as const }));
        return [...prev, ...additions];
      });
    }

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
  }, []);

  useEffect(() => {
    const urls = parseYoutubeUrls(urlText);
    const fresh = urls.filter((url) => !probedUrlsRef.current.has(url));
    if (fresh.length === 0) return;

    const timer = window.setTimeout(() => {
      void probeUrls(fresh, false);
    }, 500);
    return () => window.clearTimeout(timer);
  }, [urlText, probeUrls]);

  async function handleProbe() {
    const urls = parseYoutubeUrls(urlText);
    if (urls.length === 0) {
      setError(getT().youtube.errNoLinks);
      return;
    }
    await probeUrls(urls, true);
  }

  async function handlePickFolder() {
    const directory = await pickOutputDirectory();
    if (directory) setOutputDir(directory);
  }

  async function handleDownload() {
    if (readyItems.length === 0) {
      setError(getT().youtube.errProbeFirst);
      return;
    }
    if (!outputDir) {
      setError(getT().youtube.errNoDir);
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
      probedUrlsRef.current.clear();
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
