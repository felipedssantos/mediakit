import { describe, expect, it } from "vitest";

import {
  PRESETS,
  VIDEO_COMPRESS_PRESETS,
  VIDEO_CONVERT_PRESETS,
  fileNameFromPath,
  formatBytes,
  formatDuration,
  isVideoCompressPreset,
  isVideoConvertPreset,
} from "./presets";

describe("presets", () => {
  it("splits compress and convert video presets disjointly", () => {
    expect(VIDEO_COMPRESS_PRESETS.map((p) => p.id)).toEqual([
      "compress_web",
      "compress_quality",
      "gpu_nvenc",
    ]);
    expect(VIDEO_CONVERT_PRESETS.map((p) => p.id)).toEqual([
      "convert_mp4",
      "extract_audio",
    ]);
    expect(VIDEO_COMPRESS_PRESETS.length + VIDEO_CONVERT_PRESETS.length).toBe(
      PRESETS.length,
    );
  });

  it("classifies preset ids accurately", () => {
    expect(isVideoCompressPreset("compress_web")).toBe(true);
    expect(isVideoCompressPreset("extract_audio")).toBe(false);
    expect(isVideoConvertPreset("convert_mp4")).toBe(true);
    expect(isVideoConvertPreset("gpu_nvenc")).toBe(false);
  });

  it("extracts file names from Windows and POSIX paths", () => {
    expect(fileNameFromPath("C:\\Videos\\clip.mp4")).toBe("clip.mp4");
    expect(fileNameFromPath("/tmp/audio.m4a")).toBe("audio.m4a");
    expect(fileNameFromPath("plain.mkv")).toBe("plain.mkv");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(-10)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536 * 1024)).toBe("1.5 MB");
  });

  it("marks a recommended preset for both compress and convert flows", () => {
    expect(VIDEO_COMPRESS_PRESETS.some((p) => p.recommended)).toBe(true);
    expect(VIDEO_CONVERT_PRESETS.some((p) => p.recommended)).toBe(true);
  });

  it("formats durations in mm:ss and h:mm:ss", () => {
    expect(formatDuration(0)).toBe("—");
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(65)).toBe("1:05");
    expect(formatDuration(3661)).toBe("1:01:01");
  });
});
