import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { revealItemInDir } from "@tauri-apps/plugin-opener";

import type {
  AddJobRequest,
  EncodeOptions,
  HwCapabilities,
  Job,
  MediaInfo,
  ProgressPayload,
} from "../types/job";
import { IMAGE_EXTENSIONS } from "./imagePresets";
import { VIDEO_EXTENSIONS } from "./presets";

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

export async function pickVideoFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Vídeo", extensions: VIDEO_EXTENSIONS }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickImageFiles(): Promise<string[]> {
  const selected = await open({
    multiple: true,
    directory: false,
    filters: [{ name: "Imagem", extensions: IMAGE_EXTENSIONS }],
  });
  if (!selected) return [];
  return Array.isArray(selected) ? selected : [selected];
}

export async function pickOutputDirectory(): Promise<string | null> {
  const selected = await open({
    directory: true,
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return null;
  return selected;
}

export async function revealPath(path: string): Promise<void> {
  const target = path.trim();
  if (!target) return;
  try {
    await revealItemInDir(target);
  } catch {
    const folder = target.replace(/[/\\][^/\\]+$/, "");
    await revealItemInDir(folder || target);
  }
}
