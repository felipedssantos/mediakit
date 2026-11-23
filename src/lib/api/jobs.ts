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

export async function probeMedia(path: string): Promise<MediaInfo> {
  return invoke("probe_media", { path });
}

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

export async function addJobs(items: AddJobRequest[]): Promise<Job[]> {
  return invoke("add_jobs", { items });
}

export async function cancelJob(id: string): Promise<Job> {
  return invoke("cancel_job", { id });
}

export async function retryJob(id: string): Promise<Job> {
  return invoke("retry_job", { id });
}

export async function getJobs(): Promise<Job[]> {
  return invoke("get_jobs");
}

export async function setMaxConcurrency(value: number): Promise<number> {
  return invoke("set_max_concurrency", { value });
}

export async function getMaxConcurrency(): Promise<number> {
  return invoke("get_max_concurrency");
}

export async function detectHw(): Promise<HwCapabilities> {
  return invoke("detect_hw");
}

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

export function onJobsChanged(
  handler: (jobs: Job[]) => void,
): Promise<UnlistenFn> {
  return listen<Job[]>("jobs-changed", (event) => handler(event.payload));
}

export function onJobProgress(
  handler: (payload: ProgressPayload) => void,
): Promise<UnlistenFn> {
  return listen<ProgressPayload>("job-progress", (event) =>
    handler(event.payload),
  );
}
