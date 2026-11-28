import type { Update } from "@tauri-apps/plugin-updater";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocale } from "../hooks/useLocale";
import { useUpdater } from "../hooks/useUpdater";
import { UpdateBanner } from "./UpdateBanner";

afterEach(cleanup);

beforeEach(() => {
  useLocale.getState().setLocale("en");
  useUpdater.setState({
    update: null,
    checking: false,
    installing: false,
    phase: "idle",
    progressPercent: null,
    downloadedBytes: 0,
    totalBytes: null,
    error: null,
    dismissed: false,
  });
});

function makeMockUpdate(overrides?: Partial<Update>): Update {
  return {
    available: true,
    currentVersion: "0.3.0",
    version: "0.3.1",
    date: "2026-11-28T02:00:00Z",
    body: "Fixed updater banner styling and localization.",
    rawJson: {},
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Update;
}

describe("UpdateBanner", () => {
  it("renders version transition, localized copy, and expandable release notes", () => {
    useUpdater.setState({ update: makeMockUpdate() });
    render(<UpdateBanner />);

    expect(screen.getByText("v0.3.0")).toBeTruthy();
    expect(screen.getByText("v0.3.1")).toBeTruthy();
    expect(screen.getByText("MediaKit v0.3.1 is available")).toBeTruthy();
    expect(screen.getByText("Signed release")).toBeTruthy();
    expect(
      screen.queryByText("Fixed updater banner styling and localization."),
    ).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Release notes/i }));
    expect(
      screen.getByText("Fixed updater banner styling and localization."),
    ).toBeTruthy();
  });

  it("shows download progress in megabytes and percentage", () => {
    useUpdater.setState({
      update: makeMockUpdate(),
      installing: true,
      phase: "downloading",
      downloadedBytes: 20 * 1024 * 1024,
      totalBytes: 80 * 1024 * 1024,
      progressPercent: 25,
    });

    render(<UpdateBanner />);
    expect(screen.getByText("Downloading update package")).toBeTruthy();
    expect(screen.getByText("20.0 MB / 80.0 MB (25%)")).toBeTruthy();
    expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe(
      "25",
    );
  });

  it("dismisses when close button is clicked", () => {
    useUpdater.setState({ update: makeMockUpdate() });
    render(<UpdateBanner />);

    fireEvent.click(
      screen.getByRole("button", { name: /Dismiss update notice/i }),
    );
    expect(screen.queryByText("MediaKit v0.3.1 is available")).toBeNull();
  });
});
