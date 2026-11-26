import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

import type {
  RegionSession,
  ScreenshotHistoryItem,
  ScreenshotWindowInfo,
} from "../../types/screenshot";

export async function beginRegionCapture(): Promise<RegionSession> {
  return invoke("begin_region_capture");
}

export async function getRegionSession(): Promise<RegionSession> {
  return invoke("get_region_session");
}

function encodeMetaHeader(meta: Record<string, unknown>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(meta));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function commitSnipCapture(params: {
  action: "copy" | "save";
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  destDir?: string;
  fileName?: string;
  png?: Uint8Array;
}): Promise<void> {
  if (params.png) {
    const meta = encodeMetaHeader({
      action: params.action,
      destDir: params.destDir ?? null,
      fileName: params.fileName ?? null,
    });
    return invoke("commit_snip_annotated", params.png, {
      headers: { "x-snip-meta": meta },
    });
  }
  return invoke("commit_snip_capture", {
    action: params.action,
    x: params.x ?? null,
    y: params.y ?? null,
    width: params.width ?? null,
    height: params.height ?? null,
    destDir: params.destDir ?? null,
    fileName: params.fileName ?? null,
  });
}

export async function cancelRegionCapture(): Promise<void> {
  return invoke("cancel_region_capture");
}

export async function copyScreenshot(path: string): Promise<void> {
  return invoke("copy_screenshot", { path });
}

export async function saveScreenshot(
  sourcePath: string,
  destDir: string,
  fileName: string,
): Promise<string> {
  return invoke("save_screenshot", { sourcePath, destDir, fileName });
}

export async function defaultPictureDir(): Promise<string> {
  return invoke("default_picture_dir");
}

export function screenshotSrc(path: string): string {
  return convertFileSrc(path);
}

export function snipFrameSrc(path: string): string {
  return convertFileSrc(path, "snip");
}

export async function listScreenshotHistory(): Promise<
  ScreenshotHistoryItem[]
> {
  return invoke("list_screenshot_history");
}

export async function deleteScreenshotHistory(
  id: string,
): Promise<ScreenshotHistoryItem[]> {
  return invoke("delete_screenshot_history", { id });
}

export function onScreenshotCaptured(
  handler: (capture: ScreenshotHistoryItem) => void,
): Promise<UnlistenFn> {
  return listen<ScreenshotHistoryItem>("screenshot-captured", (event) =>
    handler(event.payload),
  );
}

export function onSnipSessionReady(
  handler: (session: RegionSession) => void,
): Promise<UnlistenFn> {
  return listen<RegionSession>("snip-session-ready", (event) =>
    handler(event.payload),
  );
}

export function onSnipWindowsReady(
  handler: (windows: ScreenshotWindowInfo[]) => void,
): Promise<UnlistenFn> {
  return listen<ScreenshotWindowInfo[]>("snip-windows-ready", (event) =>
    handler(event.payload),
  );
}
