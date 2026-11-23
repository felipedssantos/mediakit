import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  YoutubeDownloadJob,
  YoutubeDownloadOptions,
  YoutubeVideo,
} from "../../types/youtube";

export async function probeYoutube(url: string): Promise<YoutubeVideo> {
  return invoke("probe_youtube", { url });
}

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

export async function cancelYoutubeDownload(
  id: string,
): Promise<YoutubeDownloadJob> {
  return invoke("cancel_youtube_download", { id });
}

export async function retryYoutubeDownload(
  id: string,
): Promise<YoutubeDownloadJob> {
  return invoke("retry_youtube_download", { id });
}

export async function getYoutubeDownloads(): Promise<YoutubeDownloadJob[]> {
  return invoke("get_youtube_downloads");
}

export async function defaultDownloadDir(): Promise<string> {
  return invoke("default_download_dir");
}

export function onYoutubeJobsChanged(
  handler: (jobs: YoutubeDownloadJob[]) => void,
): Promise<UnlistenFn> {
  return listen<YoutubeDownloadJob[]>("yt-jobs-changed", (event) =>
    handler(event.payload),
  );
}
