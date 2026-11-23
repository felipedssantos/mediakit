import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function getCurrentWindowLabel(): string {
  return getCurrentWindow().label;
}

export async function isWindowMaximized(): Promise<boolean> {
  return getCurrentWindow().isMaximized();
}

export function onWindowResized(handler: () => void): Promise<UnlistenFn> {
  return getCurrentWindow().onResized(handler);
}

export async function minimizeWindow(): Promise<void> {
  await getCurrentWindow().minimize();
}

export async function toggleWindowMaximize(): Promise<void> {
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow(): Promise<void> {
  await getCurrentWindow().close();
}

export function onFileDrop(
  handler: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      handler(event.payload.paths);
    }
  });
}
