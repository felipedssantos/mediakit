import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useYoutubeForm } from "./useYoutubeForm";

const probeYoutubeMock = vi.fn();

vi.mock("../lib/api/youtube", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api/youtube")>();
  return {
    ...actual,
    defaultDownloadDir: vi.fn().mockResolvedValue("C:\\Users\\Test\\Videos"),
    probeYoutube: (...args: unknown[]) => probeYoutubeMock(...args),
  };
});

vi.mock("../lib/api/files", () => ({
  pickOutputDirectory: vi.fn().mockResolvedValue(null),
}));

describe("useYoutubeForm auto-probe", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    probeYoutubeMock.mockReset();
    probeYoutubeMock.mockResolvedValue({
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Sample Video",
      duration: 120,
      channel: "Channel",
      source: "YouTube",
      thumbnail: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("auto-probes valid pasted URLs after debounce without duplicate calls", async () => {
    const { result } = renderHook(() => useYoutubeForm());

    act(() => {
      result.current.setUrlText("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });

    expect(probeYoutubeMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(550);
    });

    expect(probeYoutubeMock).toHaveBeenCalledTimes(1);
    expect(probeYoutubeMock).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(result.current.readyItems).toHaveLength(1);
  });
});
