import { useCallback, useState } from "react";

import { probeMedia } from "../lib/tauri";
import { fileNameFromPath } from "../lib/presets";
import type { PendingFile } from "../types/job";

export function useMediaInfo() {
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [probing, setProbing] = useState(false);

  const addPaths = useCallback(async (paths: string[]) => {
    const unique = [...new Set(paths.filter(Boolean))];
    if (unique.length === 0) return;

    setProbing(true);
    const probed = await Promise.all(
      unique.map(async (path) => {
        const name = fileNameFromPath(path);
        try {
          const info = await probeMedia(path);
          return { path, name, info } satisfies PendingFile;
        } catch (error) {
          return {
            path,
            name,
            error: error instanceof Error ? error.message : String(error),
          } satisfies PendingFile;
        }
      }),
    );

    setFiles((current) => {
      const map = new Map(current.map((file) => [file.path, file]));
      for (const file of probed) {
        map.set(file.path, file);
      }
      return [...map.values()];
    });
    setProbing(false);
  }, []);

  const removePath = useCallback((path: string) => {
    setFiles((current) => current.filter((file) => file.path !== path));
  }, []);

  const clear = useCallback(() => setFiles([]), []);

  return { files, probing, addPaths, removePath, clear };
}
