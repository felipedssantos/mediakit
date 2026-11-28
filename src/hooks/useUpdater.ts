import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { create } from "zustand";

import { formatErrorMessage } from "./createJobQueueStore";

export type UpdatePhase = "idle" | "downloading" | "installing";

interface UpdaterStore {
  update: Update | null;
  checking: boolean;
  installing: boolean;
  phase: UpdatePhase;
  progressPercent: number | null;
  downloadedBytes: number;
  totalBytes: number | null;
  error: string | null;
  dismissed: boolean;
  checkForUpdates: (silent?: boolean) => Promise<boolean>;
  installUpdate: () => Promise<void>;
  dismiss: () => void;
}

export const useUpdater = create<UpdaterStore>((set, get) => ({
  update: null,
  checking: false,
  installing: false,
  phase: "idle",
  progressPercent: null,
  downloadedBytes: 0,
  totalBytes: null,
  error: null,
  dismissed: false,

  checkForUpdates: async (silent = true) => {
    if (get().checking || get().installing) return Boolean(get().update);
    set({ checking: true, error: silent ? get().error : null });
    try {
      const update = await check();
      set({
        update: update ?? null,
        checking: false,
        dismissed: update ? false : get().dismissed,
      });
      return Boolean(update);
    } catch (error) {
      set({
        checking: false,
        error: silent ? null : formatErrorMessage(error),
      });
      return false;
    }
  },

  installUpdate: async () => {
    const { update, installing } = get();
    if (!update || installing) return;

    set({
      installing: true,
      phase: "downloading",
      progressPercent: 0,
      downloadedBytes: 0,
      totalBytes: null,
      error: null,
    });
    let totalBytes = 0;
    let downloadedBytes = 0;

    try {
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") {
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          set({
            phase: "downloading",
            downloadedBytes: 0,
            totalBytes: totalBytes > 0 ? totalBytes : null,
            progressPercent: totalBytes > 0 ? 0 : null,
          });
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          set({
            downloadedBytes,
            progressPercent:
              totalBytes > 0
                ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
                : null,
          });
        } else if (event.event === "Finished") {
          set({
            phase: "installing",
            progressPercent: 100,
          });
        }
      });

      await relaunch();
    } catch (error) {
      set({
        installing: false,
        phase: "idle",
        progressPercent: null,
        downloadedBytes: 0,
        totalBytes: null,
        error: formatErrorMessage(error),
      });
    }
  },

  dismiss: () => set({ dismissed: true }),
}));
