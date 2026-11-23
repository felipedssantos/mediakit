import { create } from "zustand";

import type { ImageFormat, ImagePresetId } from "../lib/imagePresets";
import type { AudioContainer, PresetId, VideoContainer } from "../lib/presets";
import type { YoutubeDownloadOptions } from "../types/youtube";

export interface AppSettingsData {
  defaultOutputDir: string | null;
  videoCompressPreset: PresetId;
  videoConvertContainer: VideoContainer;
  audioExtractContainer: AudioContainer;
  preferGpu: boolean;
  imageCompressPreset: ImagePresetId;
  imageConvertFormat: ImageFormat;
  youtubeMode: "video" | "audio";
  youtubeQuality: YoutubeDownloadOptions["quality"];
  youtubeAudioFormat: YoutubeDownloadOptions["audio_format"];
  youtubeOutputDir: string | null;
}

export const DEFAULT_APP_SETTINGS: AppSettingsData = {
  defaultOutputDir: null,
  videoCompressPreset: "compress_web",
  videoConvertContainer: "mp4",
  audioExtractContainer: "m4a",
  preferGpu: false,
  imageCompressPreset: "img_compress_web",
  imageConvertFormat: "jpeg",
  youtubeMode: "video",
  youtubeQuality: "best",
  youtubeAudioFormat: "m4a",
  youtubeOutputDir: null,
};

const STORAGE_KEY = "mediakit.appSettings";

function loadSettings(): AppSettingsData {
  if (typeof window === "undefined") return { ...DEFAULT_APP_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APP_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<AppSettingsData>;
    return { ...DEFAULT_APP_SETTINGS, ...parsed };
  } catch {
    return { ...DEFAULT_APP_SETTINGS };
  }
}

function saveSettings(data: AppSettingsData) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore storage write errors in restricted environments.
  }
}

interface AppSettingsStore extends AppSettingsData {
  updateSettings: (patch: Partial<AppSettingsData>) => void;
  resetSettings: () => void;
}

function extractData(state: AppSettingsStore): AppSettingsData {
  return {
    defaultOutputDir: state.defaultOutputDir,
    videoCompressPreset: state.videoCompressPreset,
    videoConvertContainer: state.videoConvertContainer,
    audioExtractContainer: state.audioExtractContainer,
    preferGpu: state.preferGpu,
    imageCompressPreset: state.imageCompressPreset,
    imageConvertFormat: state.imageConvertFormat,
    youtubeMode: state.youtubeMode,
    youtubeQuality: state.youtubeQuality,
    youtubeAudioFormat: state.youtubeAudioFormat,
    youtubeOutputDir: state.youtubeOutputDir,
  };
}

export const useAppSettings = create<AppSettingsStore>((set) => ({
  ...loadSettings(),
  updateSettings: (patch) =>
    set((state) => {
      const next = { ...extractData(state), ...patch };
      saveSettings(next);
      return next;
    }),
  resetSettings: () => {
    const next = { ...DEFAULT_APP_SETTINGS };
    saveSettings(next);
    set(next);
  },
}));
