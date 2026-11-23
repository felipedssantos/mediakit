import { useEffect, useState } from "react";

import { TitleBar } from "./components/TitleBar";
import { Toast } from "./components/Toast";
import { useScreenshotHistory } from "./hooks/useScreenshotHistory";
import { useScreenshotSettings } from "./hooks/useScreenshotSettings";
import { useToast } from "./hooks/useToast";
import { ptBR } from "./i18n/pt-BR";
import {
  beginRegionCapture,
  onScreenshotCaptured,
} from "./lib/api/screenshot";
import { SCREENSHOT_ENABLED } from "./lib/features";
import { ImageConverterPage } from "./pages/ImageConverterPage";
import { ConverterPage } from "./pages/ConverterPage";
import { HomePage } from "./pages/HomePage";
import { ScreenshotPage } from "./pages/ScreenshotPage";
import { SnipOverlayPage } from "./pages/SnipOverlayPage";
import { YoutubePage } from "./pages/YoutubePage";
import type { AppScreen } from "./types/navigation";

declare global {
  interface Window {
    __CONVERSOR_SNIP__?: boolean;
  }
}

const isSnipOverlay =
  window.__CONVERSOR_SNIP__ === true ||
  new URLSearchParams(window.location.search).has("snip");

export default function App() {
  const [screen, setScreen] = useState<AppScreen>("home");
  const prepend = useScreenshotHistory((state) => state.prepend);
  const hydrate = useScreenshotHistory((state) => state.hydrate);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);
  const showToast = useToast((state) => state.show);

  useEffect(() => {
    if (isSnipOverlay || !SCREENSHOT_ENABLED) return;
    let unlisten: (() => void) | undefined;
    void hydrate();
    void hydrateSettings();
    void onScreenshotCaptured((capture) => {
      prepend(capture);
      if (capture.action === "copy") {
        showToast(ptBR.screenshot.toastCopied);
      }
    }).then((fn) => {
      unlisten = fn;
    });
    function onKey(event: KeyboardEvent) {
      if (event.key !== "PrintScreen") return;
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
    <div className="relative flex h-full min-h-0 flex-col bg-void">
      <TitleBar />
      <div className="min-h-0 flex-1 overflow-hidden border-t border-rule">
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
          <YoutubePage key="youtube" onBack={() => setScreen("home")} />
        ) : screen === "screenshot" && SCREENSHOT_ENABLED ? (
          <ScreenshotPage key="screenshot" onBack={() => setScreen("home")} />
        ) : (
          <HomePage key="home" onSelect={setScreen} />
        )}
      </div>
      <Toast />
    </div>
  );
}
