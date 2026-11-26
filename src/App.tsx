import { useEffect, useMemo, useState } from "react";

import { Sidebar } from "./components/Sidebar";
import { SidecarBanner } from "./components/SidecarBanner";
import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";
import { useJobEvents, useJobs } from "./hooks/useJobs";
import { useScreenshotHistory } from "./hooks/useScreenshotHistory";
import { useScreenshotSettings } from "./hooks/useScreenshotSettings";
import { useSidecars } from "./hooks/useSidecars";
import { useThemeSync } from "./hooks/useTheme";
import { useToast } from "./hooks/useToast";
import { useYoutubeJobEvents, useYoutubeJobs } from "./hooks/useYoutubeJobs";
import { getT, useT } from "./hooks/useLocale";
import { beginRegionCapture, onScreenshotCaptured } from "./lib/api/screenshot";
import { SCREENSHOT_ENABLED } from "./lib/features";
import {
  isImageCompressPreset,
  isImageConvertPreset,
} from "./lib/imagePresets";
import { isVideoCompressPreset, isVideoConvertPreset } from "./lib/presets";
import { ConverterPage } from "./pages/ConverterPage";
import { HomePage } from "./pages/HomePage";
import { ImageConverterPage } from "./pages/ImageConverterPage";
import { ScreenshotPage } from "./pages/ScreenshotPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SnipOverlayPage } from "./pages/SnipOverlayPage";
import { YoutubePage } from "./pages/YoutubePage";
import type { AppScreen } from "./types/navigation";

declare global {
  interface Window {
    __MEDIAKIT_SNIP__?: boolean;
  }
}

const isSnipOverlay =
  window.__MEDIAKIT_SNIP__ === true ||
  new URLSearchParams(window.location.search).has("snip");

function isActiveStatus(status: string) {
  return status === "queued" || status === "running" || status === "finalizing";
}

export default function App() {
  useThemeSync();
  useJobEvents();
  useYoutubeJobEvents();
  const t = useT();

  const screenTitles: Partial<Record<AppScreen, string>> = {
    video_compress: t.converter.compressTitle,
    video_convert: t.converter.convertTitle,
    image_compress: t.imageConverter.compressTitle,
    image_convert: t.imageConverter.convertTitle,
    youtube: t.youtube.title,
    screenshot: t.screenshot.title,
    settings: t.settings.title,
  };

  const [screen, setScreen] = useState<AppScreen>("home");
  const prepend = useScreenshotHistory((state) => state.prepend);
  const hydrate = useScreenshotHistory((state) => state.hydrate);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);
  const checkSidecars = useSidecars((state) => state.check);
  const loadSidecarConfig = useSidecars((state) => state.loadConfig);
  const showToast = useToast((state) => state.show);

  const jobs = useJobs((state) => state.jobs);
  const nvenc = useJobs((state) => state.nvenc);
  const gpu = useJobs((state) => state.gpu);
  const youtubeJobs = useYoutubeJobs((state) => state.jobs);

  const activeCounts = useMemo<Partial<Record<AppScreen, number>>>(() => {
    const active = jobs.filter((job) => isActiveStatus(job.status));
    return {
      video_compress: active.filter((j) => isVideoCompressPreset(j.preset_id))
        .length,
      video_convert: active.filter((j) => isVideoConvertPreset(j.preset_id))
        .length,
      image_compress: active.filter((j) => isImageCompressPreset(j.preset_id))
        .length,
      image_convert: active.filter((j) => isImageConvertPreset(j.preset_id))
        .length,
      youtube: youtubeJobs.filter((j) => isActiveStatus(j.status)).length,
    };
  }, [jobs, youtubeJobs]);

  const totalActiveJobs = useMemo(
    () =>
      Object.values(activeCounts).reduce((sum, value) => sum + (value ?? 0), 0),
    [activeCounts],
  );

  useEffect(() => {
    if (isSnipOverlay) return;
    void loadSidecarConfig();
    void checkSidecars();
  }, [checkSidecars, loadSidecarConfig]);

  useEffect(() => {
    if (isSnipOverlay || !SCREENSHOT_ENABLED) return;
    let unlisten: (() => void) | undefined;
    void hydrate();
    void hydrateSettings();
    void onScreenshotCaptured((capture) => {
      prepend(capture);
      if (capture.action === "copy") {
        showToast(getT().screenshot.toastCopied);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    function onKey(event: KeyboardEvent) {
      const isPrintKey = event.key === "PrintScreen";
      const isAltShiftS =
        event.altKey &&
        event.shiftKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        event.key.toLowerCase() === "s";
      if (!isPrintKey && !isAltShiftS) return;
      event.preventDefault();
      void beginRegionCapture();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      unlisten?.();
      window.removeEventListener("keydown", onKey);
    };
  }, [hydrate, hydrateSettings, prepend, showToast]);

  if (isSnipOverlay) {
    return <SnipOverlayPage />;
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-canvas text-ink">
      <TitleBar
        currentTitle={screenTitles[screen]}
        onOpenSettings={() => setScreen("settings")}
        settingsActive={screen === "settings"}
      />
      <SidecarBanner onOpenSettings={() => setScreen("settings")} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <Sidebar
          current={screen}
          onSelect={setScreen}
          activeCounts={activeCounts}
          nvencAvailable={nvenc}
          gpuVendor={gpu}
        />
        <div className="min-w-0 flex-1 overflow-hidden">
          {screen === "video_compress" ? (
            <ConverterPage
              key="video_compress"
              mode="compress"
              onBack={() => setScreen("home")}
            />
          ) : screen === "video_convert" ? (
            <ConverterPage
              key="video_convert"
              mode="convert"
              onBack={() => setScreen("home")}
            />
          ) : screen === "image_compress" ? (
            <ImageConverterPage
              key="image_compress"
              mode="compress"
              onBack={() => setScreen("home")}
            />
          ) : screen === "image_convert" ? (
            <ImageConverterPage
              key="image_convert"
              mode="convert"
              onBack={() => setScreen("home")}
            />
          ) : screen === "youtube" ? (
            <YoutubePage key="youtube" />
          ) : screen === "screenshot" && SCREENSHOT_ENABLED ? (
            <ScreenshotPage key="screenshot" />
          ) : screen === "settings" ? (
            <SettingsPage key="settings" onBack={() => setScreen("home")} />
          ) : (
            <HomePage
              key="home"
              onSelect={setScreen}
              nvencAvailable={nvenc}
              gpuVendor={gpu}
              activeJobCount={totalActiveJobs}
            />
          )}
        </div>
      </div>
      <Toast />
    </div>
  );
}
