import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  SidecarConfig,
  SidecarRepairProgress,
  SidecarStatusReport,
} from "../../types/sidecar";

/** Checks whether ffmpeg, ffprobe, and yt-dlp are available and executable. */
export async function checkSidecars(): Promise<SidecarStatusReport> {
  return invoke("check_sidecars");
}

/** Downloads and verifies missing sidecars into the local app data directory. */
export async function repairSidecars(
  targets?: string[],
): Promise<SidecarStatusReport> {
  return invoke("repair_sidecars", { targets: targets ?? null });
}

/** Loads persisted custom sidecar directory and executable path overrides. */
export async function getSidecarConfig(): Promise<SidecarConfig> {
  return invoke("get_sidecar_config");
}

/** Saves custom sidecar directory and executable path overrides. */
export async function setSidecarConfig(
  config: SidecarConfig,
): Promise<SidecarConfig> {
  return invoke("set_sidecar_config", { config });
}

/** Subscribes to backend auto-repair progress events. */
export function onSidecarRepairProgress(
  handler: (payload: SidecarRepairProgress) => void,
): Promise<UnlistenFn> {
  return listen<SidecarRepairProgress>("sidecar-repair-progress", (event) =>
    handler(event.payload),
  );
}
