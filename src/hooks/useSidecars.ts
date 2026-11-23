import { create } from "zustand";

import {
  checkSidecars,
  getSidecarConfig,
  onSidecarRepairProgress,
  repairSidecars,
  setSidecarConfig,
} from "../lib/api/sidecar";
import type {
  SidecarConfig,
  SidecarRepairProgress,
  SidecarStatusReport,
} from "../types/sidecar";
import { formatErrorMessage } from "./createJobQueueStore";
import { useJobs } from "./useJobs";

const EMPTY_CONFIG: SidecarConfig = {
  custom_dir: null,
  ffmpeg_path: null,
  ffprobe_path: null,
  ytdlp_path: null,
};

interface SidecarsStore {
  report: SidecarStatusReport | null;
  config: SidecarConfig;
  checking: boolean;
  repairing: boolean;
  progress: SidecarRepairProgress | null;
  error: string | null;
  bannerDismissed: boolean;
  check: () => Promise<SidecarStatusReport | null>;
  loadConfig: () => Promise<void>;
  saveConfig: (patch: Partial<SidecarConfig>) => Promise<void>;
  repair: (targets?: string[]) => Promise<SidecarStatusReport | null>;
  dismissBanner: () => void;
}

export const useSidecars = create<SidecarsStore>((set, get) => ({
  report: null,
  config: EMPTY_CONFIG,
  checking: false,
  repairing: false,
  progress: null,
  error: null,
  bannerDismissed: false,
  check: async () => {
    set({ checking: true, error: null });
    try {
      const report = await checkSidecars();
      set({
        report,
        checking: false,
        bannerDismissed: report.all_ok ? false : get().bannerDismissed,
      });
      return report;
    } catch (error) {
      set({ checking: false, error: formatErrorMessage(error) });
      return null;
    }
  },
  loadConfig: async () => {
    try {
      const config = await getSidecarConfig();
      set({ config });
    } catch {
      // Keep default empty config when backend is unavailable (e.g. unit tests).
    }
  },
  saveConfig: async (patch) => {
    const nextConfig: SidecarConfig = { ...get().config, ...patch };
    set({ error: null });
    try {
      const saved = await setSidecarConfig(nextConfig);
      set({ config: saved });
      await get().check();
      await useJobs.getState().hydrate();
    } catch (error) {
      set({ error: formatErrorMessage(error) });
      throw error;
    }
  },
  repair: async (targets) => {
    if (get().repairing) return null;
    set({ repairing: true, error: null, progress: null });
    const unlisten = await onSidecarRepairProgress((progress) => {
      set({ progress });
    });
    try {
      const report = await repairSidecars(targets);
      set({
        report,
        repairing: false,
        progress: null,
        bannerDismissed: report.all_ok ? false : get().bannerDismissed,
      });
      await useJobs.getState().hydrate();
      return report;
    } catch (error) {
      set({
        repairing: false,
        progress: null,
        error: formatErrorMessage(error),
      });
      return null;
    } finally {
      unlisten();
    }
  },
  dismissBanner: () => set({ bannerDismissed: true }),
}));
