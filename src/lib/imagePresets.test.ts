import { describe, expect, it } from "vitest";

import {
  IMAGE_COMPRESS_PRESETS,
  IMAGE_CONVERT_PRESETS,
  IMAGE_PRESETS,
  imagePresetById,
  isImageCompressPreset,
  isImageConvertPreset,
  isImagePath,
  isImagePresetId,
  presetIdForImageFormat,
} from "./imagePresets";

describe("imagePresets", () => {
  it("partitions image presets into compress and convert groups", () => {
    expect(IMAGE_COMPRESS_PRESETS.map((p) => p.id)).toEqual([
      "img_compress_web",
      "img_compress_quality",
    ]);
    expect(IMAGE_CONVERT_PRESETS.map((p) => p.id)).toEqual([
      "img_convert_jpeg",
      "img_convert_png",
      "img_convert_webp",
    ]);
    expect(IMAGE_COMPRESS_PRESETS.length + IMAGE_CONVERT_PRESETS.length).toBe(
      IMAGE_PRESETS.length,
    );
  });

  it("identifies image preset ids and groups", () => {
    expect(isImagePresetId("img_convert_png")).toBe(true);
    expect(isImagePresetId("compress_web")).toBe(false);
    expect(isImageCompressPreset("img_compress_web")).toBe(true);
    expect(isImageConvertPreset("img_compress_web")).toBe(false);
    expect(isImageConvertPreset("img_convert_webp")).toBe(true);
  });

  it("matches supported image file extensions case-insensitively", () => {
    expect(isImagePath("C:\\Photos\\IMG_001.HEIC")).toBe(true);
    expect(isImagePath("/home/user/pic.webp")).toBe(true);
    expect(isImagePath("C:\\Videos\\clip.mp4")).toBe(false);
    expect(isImagePath("no-extension")).toBe(false);
  });

  it("marks a recommended preset for image compression", () => {
    expect(IMAGE_COMPRESS_PRESETS.some((p) => p.recommended)).toBe(true);
  });

  it("resolves presets by id and output format", () => {
    expect(imagePresetById("img_convert_png")?.defaultQuality).toBeNull();
    expect(imagePresetById("unknown")).toBeUndefined();
    expect(presetIdForImageFormat("png")).toBe("img_convert_png");
    expect(presetIdForImageFormat("webp")).toBe("img_convert_webp");
    expect(presetIdForImageFormat("jpeg")).toBe("img_convert_jpeg");
    expect(presetIdForImageFormat("tiff")).toBe("img_convert_jpeg");
  });
});
