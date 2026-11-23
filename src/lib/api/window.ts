import type { UnlistenFn } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Returns the label of the current Tauri window. */
export function getCurrentWindowLabel(): string {
  return getCurrentWindow().label;
}

/** Checks whether the current Tauri window is maximized. */
export async function isWindowMaximized(): Promise<boolean> {
  return getCurrentWindow().isMaximized();
}

/** Subscribes to window resize events. */
export function onWindowResized(handler: () => void): Promise<UnlistenFn> {
  return getCurrentWindow().onResized(handler);
}

/** Minimizes the current window. */
export async function minimizeWindow(): Promise<void> {
  await getCurrentWindow().minimize();
}

/** Toggles between maximized and restored window state. */
export async function toggleWindowMaximize(): Promise<void> {
  await getCurrentWindow().toggleMaximize();
}

/** Closes the current window (main window hides to the system tray). */
export async function closeWindow(): Promise<void> {
  await getCurrentWindow().close();
}

/** Subscribes to native OS file drops on the current webview. */
export function onFileDrop(
  handler: (paths: string[]) => void,
): Promise<UnlistenFn> {
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      handler(event.payload.paths);
    }
  });
}
