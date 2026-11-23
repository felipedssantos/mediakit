import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  YoutubeDownloadJob,
  YoutubeDownloadOptions,
  YoutubeVideo,
} from "../../types/youtube";

/** Probes a video URL with yt-dlp and returns metadata without downloading. */
export async function probeYoutube(url: string): Promise<YoutubeVideo> {
  return invoke("probe_youtube", { url });
}

/** Enqueues a yt-dlp download job in the backend download queue. */
export async function addYoutubeDownload(params: {
  url: string;
  title: string;
  outputDir: string;
  options: YoutubeDownloadOptions;
}): Promise<YoutubeDownloadJob> {
  return invoke("add_youtube_download", {
    url: params.url,
    title: params.title,
    outputDir: params.outputDir,
    options: params.options,
  });
}

/** Requests cancellation of a queued or active download job. */
export async function cancelYoutubeDownload(
  id: string,
): Promise<YoutubeDownloadJob> {
  return invoke("cancel_youtube_download", { id });
}

/** Re-queues a failed or cancelled download job. */
export async function retryYoutubeDownload(
  id: string,
): Promise<YoutubeDownloadJob> {
  return invoke("retry_youtube_download", { id });
}

/** Returns all download jobs currently tracked by the backend. */
export async function getYoutubeDownloads(): Promise<YoutubeDownloadJob[]> {
  return invoke("get_youtube_downloads");
}

/** Resolves the user's default Videos directory for downloads. */
export async function defaultDownloadDir(): Promise<string> {
  return invoke("default_download_dir");
}

/** Subscribes to full download queue snapshots emitted by the backend. */
export function onYoutubeJobsChanged(
  handler: (jobs: YoutubeDownloadJob[]) => void,
): Promise<UnlistenFn> {
  return listen<YoutubeDownloadJob[]>("yt-jobs-changed", (event) =>
    handler(event.payload),
  );
}
