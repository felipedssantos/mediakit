import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  AddJobRequest,
  EncodeOptions,
  HwCapabilities,
  Job,
  MediaInfo,
  ProgressPayload,
} from "../../types/job";

/** Probes a local media file with ffprobe and returns stream/container metadata. */
export async function probeMedia(path: string): Promise<MediaInfo> {
  return invoke("probe_media", { path });
}

/** Enqueues a single conversion or compression job. */
export async function addJob(params: {
  inputPath: string;
  outputPath?: string;
  outputDir?: string;
  options: EncodeOptions;
}): Promise<Job> {
  return invoke("add_job", {
    inputPath: params.inputPath,
    outputPath: params.outputPath ?? null,
    outputDir: params.outputDir ?? null,
    options: params.options,
  });
}

/** Enqueues a batch of conversion jobs. */
export async function addJobs(items: AddJobRequest[]): Promise<Job[]> {
  return invoke("add_jobs", { items });
}

/** Requests cancellation of a queued or running conversion job. */
export async function cancelJob(id: string): Promise<Job> {
  return invoke("cancel_job", { id });
}

/** Re-queues a failed or cancelled conversion job. */
export async function retryJob(id: string): Promise<Job> {
  return invoke("retry_job", { id });
}

/** Returns all conversion jobs currently held in the backend queue. */
export async function getJobs(): Promise<Job[]> {
  return invoke("get_jobs");
}

/** Updates maximum parallel FFmpeg workers (clamped to 1..4 on the backend). */
export async function setMaxConcurrency(value: number): Promise<number> {
  return invoke("set_max_concurrency", { value });
}

/** Fetches the active conversion worker concurrency limit. */
export async function getMaxConcurrency(): Promise<number> {
  return invoke("get_max_concurrency");
}

/** Checks whether NVIDIA NVENC hardware encoding is available on this machine. */
export async function detectHw(): Promise<HwCapabilities> {
  return invoke("detect_hw");
}

/** Computes a non-clobbering default output path for a given preset and format. */
export async function suggestOutputPath(
  inputPath: string,
  presetId: string,
  outputDir?: string,
  imageFormat?: string,
): Promise<string> {
  return invoke("suggest_output_path", {
    inputPath,
    presetId,
    outputDir: outputDir ?? null,
    imageFormat: imageFormat ?? null,
  });
}

/** Subscribes to full conversion queue snapshots emitted by the backend. */
export function onJobsChanged(
  handler: (jobs: Job[]) => void,
): Promise<UnlistenFn> {
  return listen<Job[]>("jobs-changed", (event) => handler(event.payload));
}

/** Subscribes to per-job progress updates emitted during encoding. */
export function onJobProgress(
  handler: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>("job-progress", (event) =>
    handler(event.payload),
  );
}
