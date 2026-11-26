import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAppSettings } from "../hooks/useAppSettings";
import { useLocale } from "../hooks/useLocale";
import { SettingsPage } from "../pages/SettingsPage";
import { Sidebar } from "./Sidebar";
import { TitleBar } from "./TitleBar";

afterEach(cleanup);
beforeEach(() => {
  useLocale.getState().setLocale("en");
});

vi.mock("../lib/api/window", () => ({
  closeWindow: vi.fn(),
  isWindowMaximized: vi.fn().mockResolvedValue(false),
  minimizeWindow: vi.fn(),
  onWindowResized: vi.fn().mockResolvedValue(() => {}),
  toggleWindowMaximize: vi.fn(),
}));

describe("AppShell navigation and theme", () => {
  it("marks active sidebar item and shows active job badges", () => {
    const onSelect = vi.fn();
    render(
      <Sidebar
        current="video_compress"
        onSelect={onSelect}
        activeCounts={{ video_compress: 3, youtube: 1 }}
      />,
    );

    const activeBtn = screen.getByRole("button", {
      name: /Compress video/i,
    });
    expect(activeBtn.getAttribute("aria-current")).toBe("page");
    expect(screen.getByLabelText("3 active")).toBeTruthy();
    expect(screen.getByLabelText("1 active")).toBeTruthy();
    expect(screen.getByText("v0.3.0 Beta")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Download video/i }));
    expect(onSelect).toHaveBeenCalledWith("youtube");
  });

  it("toggles Light/Dark theme from TitleBar", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(<TitleBar currentTitle="Compress video" />);

    expect(screen.getByText("Compress video")).toBeTruthy();
    expect(screen.getByText("Beta")).toBeTruthy();
    const toggle = screen.getByRole("button", {
      name: /Switch to light mode|Switch to dark mode/i,
    });
    const before = document.documentElement.getAttribute("data-theme");
    fireEvent.click(toggle);
    const after = document.documentElement.getAttribute("data-theme");

    expect(after).not.toBe(before);
    expect(["light", "dark"]).toContain(after);
  });

  it("opens Settings from TitleBar icon", () => {
    const onOpenSettings = vi.fn();
    render(<TitleBar currentTitle="Home" onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("updates and resets app presets in SettingsPage", () => {
    useAppSettings.getState().resetSettings();
    const onBack = vi.fn();
    render(<SettingsPage onBack={onBack} />);

    fireEvent.click(screen.getByRole("button", { name: "WebP" }));
    expect(useAppSettings.getState().imageConvertFormat).toBe("webp");

    fireEvent.click(screen.getByRole("button", { name: "Audio only" }));
    expect(useAppSettings.getState().youtubeMode).toBe("audio");

    fireEvent.click(screen.getByRole("button", { name: "Restore defaults" }));
    expect(useAppSettings.getState().imageConvertFormat).toBe("jpeg");
    expect(useAppSettings.getState().youtubeMode).toBe("video");
  });

  it("switches UI language across all supported locales in SettingsPage", () => {
    useLocale.getState().setLocale("en");
    render(<SettingsPage onBack={vi.fn()} />);

    const select = screen.getByLabelText("Language");

    fireEvent.change(select, { target: { value: "pt-BR" } });
    expect(useLocale.getState().locale).toBe("pt-BR");
    expect(document.documentElement.lang).toBe("pt-BR");
    expect(screen.getByRole("heading", { name: "Configurações" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "es" } });
    expect(screen.getByRole("heading", { name: "Configuración" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "fr" } });
    expect(screen.getByRole("heading", { name: "Paramètres" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "pt-PT" } });
    expect(screen.getByRole("heading", { name: "Definições" })).toBeTruthy();

    fireEvent.change(select, { target: { value: "en" } });
    expect(screen.getByRole("heading", { name: "Settings" })).toBeTruthy();
  });

  it("displays detected GPU vendor in Sidebar", () => {
    useLocale.getState().setLocale("en");
    const { rerender } = render(
      <Sidebar
        current="home"
        onSelect={vi.fn()}
        nvencAvailable={true}
        gpuVendor="amd"
      />,
    );
    expect(screen.getByText("GPU AMD")).toBeTruthy();

    rerender(
      <Sidebar
        current="home"
        onSelect={vi.fn()}
        nvencAvailable={false}
        gpuVendor={null}
      />,
    );
    expect(screen.getByText("Local processing (CPU)")).toBeTruthy();
  });
});
