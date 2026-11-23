import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ImageOutputSettings } from "./ImageOutputSettings";
import { OutputSettings } from "./OutputSettings";

afterEach(cleanup);

describe("Settings disclosure and layman quality controls", () => {
  it("keeps advanced options collapsed by default and maps simple quality tiers to CRF", () => {
    const onCrfChange = vi.fn();
    render(
      <OutputSettings
        presetId="compress_web"
        crf={26}
        resolution="original"
        videoCodec="h264"
        useGpu={false}
        nvencAvailable={false}
        maxConcurrency={2}
        outputDir={null}
        onCrfChange={onCrfChange}
        onResolutionChange={vi.fn()}
        onVideoCodecChange={vi.fn()}
        onUseGpuChange={vi.fn()}
        onConcurrencyChange={vi.fn()}
        onPickOutputDir={vi.fn()}
      />,
    );

    const toggle = screen.getByRole("button", { name: /Advanced options/i });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(/Video standard/i)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Smallest size/i }));
    expect(onCrfChange).toHaveBeenCalledWith(31);

    fireEvent.click(screen.getByRole("button", { name: /Maximum quality/i }));
    expect(onCrfChange).toHaveBeenCalledWith(20);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText(/No compatible GPU/i)).toBeTruthy();
  });

  it("disables GPU when container is webm and shows fixed codec notice", () => {
    render(
      <OutputSettings
        presetId="convert_mp4"
        crf={18}
        resolution="original"
        videoCodec="h264"
        useGpu={false}
        nvencAvailable={true}
        maxConcurrency={2}
        outputDir={null}
        container="webm"
        onCrfChange={vi.fn()}
        onResolutionChange={vi.fn()}
        onVideoCodecChange={vi.fn()}
        onUseGpuChange={vi.fn()}
        onConcurrencyChange={vi.fn()}
        onPickOutputDir={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Advanced options/i }));
    expect(screen.getByText(/VP9 \+ Opus/i)).toBeTruthy();
    const gpuCheckbox = screen.getByRole("checkbox");
    expect((gpuCheckbox as HTMLInputElement).disabled).toBe(true);
  });

  it("hides quality picker and shows lossless notice for PNG images", () => {
    render(
      <ImageOutputSettings
        quality={85}
        resolution="original"
        imageFormat="png"
        maxConcurrency={2}
        outputDir={null}
        onQualityChange={vi.fn()}
        onResolutionChange={vi.fn()}
        onFormatChange={vi.fn()}
        onConcurrencyChange={vi.fn()}
        onPickOutputDir={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /Smallest size/i })).toBeNull();
    expect(screen.getByText(/PNG, BMP, and TIFF are lossless/i)).toBeTruthy();
  });
});
