import { create } from "zustand";

import { defaultPictureDir } from "../lib/screenshot";

const STORAGE_KEY = "conversor-screenshot-output-dir";

interface ScreenshotSettingsState {
  outputDir: string;
  hydrate: () => Promise<void>;
  setOutputDir: (dir: string) => void;
}

export const useScreenshotSettings = create<ScreenshotSettingsState>((set) => ({
  outputDir: "",
  hydrate: async () => {
    const saved = localStorage.getItem(STORAGE_KEY)?.trim();
    if (saved) {
      set({ outputDir: saved });
      return;
    }
    const dir = await defaultPictureDir().catch(() => "");
    set({ outputDir: dir });
  },
  setOutputDir: (dir) => {
    localStorage.setItem(STORAGE_KEY, dir);
    set({ outputDir: dir });
  },
}));
