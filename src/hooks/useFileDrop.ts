import { useEffect } from "react";

import { onFileDrop } from "../lib/api/window";

/** Registers a Tauri webview drag-and-drop file listener for the active page. */
export function useFileDrop(onDrop: (paths: string[]) => void | Promise<void>) {
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    void onFileDrop((paths) => {
      void onDrop(paths);
    }).then((fn) => {
      unlisten = fn;
    });
    return () => unlisten?.();
  }, [onDrop]);
}
