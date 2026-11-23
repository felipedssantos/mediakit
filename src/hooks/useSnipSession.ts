import { useEffect, useRef, useState } from "react";

import { pickOutputDirectory } from "../lib/api/files";
import {
  cancelRegionCapture,
  commitSnipCapture,
  getRegionSession,
  onSnipSessionReady,
  onSnipWindowsReady,
  screenshotSrc,
} from "../lib/api/screenshot";
import { getCurrentWindowLabel } from "../lib/api/window";
import { printFileName } from "../lib/screenshot";
import {
  nextShapeId,
  rasterizeAnnotatedPng,
  type AnnotShape,
} from "../lib/snipAnnotate";
import type { Point, Rect } from "../lib/snipGeometry";
import type { RegionSession, ScreenshotWindowInfo } from "../types/screenshot";
import { formatErrorMessage } from "./createJobQueueStore";
import { useScreenshotSettings } from "./useScreenshotSettings";

export interface DraftText {
  x: number;
  y: number;
  value: string;
}

const overlayLabel = getCurrentWindowLabel();

export function useSnipSession(onSessionReset: () => void) {
  const [session, setSession] = useState<RegionSession | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [action, setAction] = useState<"copy" | "save">("copy");
  const outputDir = useScreenshotSettings((state) => state.outputDir);
  const setOutputDir = useScreenshotSettings((state) => state.setOutputDir);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);
  const [error, setError] = useState<string | null>(null);
  const [shapes, setShapes] = useState<AnnotShape[]>([]);
  const [draftText, setDraftText] = useState<DraftText | null>(null);
  const [hovered, setHovered] = useState<ScreenshotWindowInfo | null>(null);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);

  const finished = useRef(false);
  const shapesRef = useRef(shapes);
  const draftTextRef = useRef(draftText);
  const resetRef = useRef(onSessionReset);

  useEffect(() => {
    shapesRef.current = shapes;
    draftTextRef.current = draftText;
    resetRef.current = onSessionReset;
  }, [shapes, draftText, onSessionReset]);

  useEffect(() => {
    let cancelled = false;
    let unlistenSession: (() => void) | undefined;
    let unlistenWindows: (() => void) | undefined;

    function applySession(next: RegionSession) {
      if (next.overlay_label && next.overlay_label !== overlayLabel) return;
      finished.current = false;
      setError(null);
      setHovered(null);
      setOrigin(null);
      setCurrent(null);
      setShapes([]);
      setDraftText(null);
      resetRef.current();
      setSession(next);
      setSrc(screenshotSrc(next.path));
    }

    function loadSession() {
      if (document.visibilityState !== "visible") return;
      void getRegionSession()
        .then((next) => {
          if (cancelled) return;
          applySession(next);
        })
        .catch(() => {});
    }

    void hydrateSettings();
    loadSession();
    document.addEventListener("visibilitychange", loadSession);

    void onSnipSessionReady((next) => {
      if (cancelled) return;
      applySession(next);
    }).then((fn) => {
      unlistenSession = fn;
    });

    void onSnipWindowsReady((windows) => {
      if (cancelled) return;
      setSession((currentSession) =>
        currentSession ? { ...currentSession, windows } : currentSession,
      );
    }).then((fn) => {
      unlistenWindows = fn;
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", loadSession);
      unlistenSession?.();
      unlistenWindows?.();
    };
  }, [hydrateSettings]);

  async function handleCancel() {
    if (finished.current) return;
    finished.current = true;
    try {
      await cancelRegionCapture();
    } catch {
      finished.current = false;
    }
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        if (draftTextRef.current) return;
        event.preventDefault();
        setShapes((currentShapes) => currentShapes.slice(0, -1));
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (draftTextRef.current) {
        setDraftText(null);
        return;
      }
      void handleCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function confirmDraftText() {
    const draft = draftTextRef.current;
    if (!draft) return;
    const text = draft.value.trim();
    setDraftText(null);
    if (!text) return;
    setShapes((currentShapes) => [
      ...currentShapes,
      { id: nextShapeId(), kind: "text", x: draft.x, y: draft.y, text },
    ]);
  }

  async function commit(crop?: Rect, nextAction: "copy" | "save" = action) {
    if (!session || !src || finished.current) return;
    let destDir = outputDir;
    if (nextAction === "save") {
      if (!destDir) {
        const directory = await pickOutputDirectory();
        if (!directory) return;
        destDir = directory;
        setOutputDir(directory);
      }
    }
    finished.current = true;
    setError(null);
    try {
      const currentShapes = shapesRef.current;
      const png =
        currentShapes.length > 0
          ? await rasterizeAnnotatedPng(
              src,
              session.width,
              session.height,
              currentShapes,
              crop,
            )
          : undefined;
      await commitSnipCapture({
        action: nextAction,
        x: png ? undefined : crop?.x,
        y: png ? undefined : crop?.y,
        width: png ? undefined : crop?.width,
        height: png ? undefined : crop?.height,
        destDir,
        fileName: printFileName(),
        png,
      });
    } catch (err) {
      finished.current = false;
      setError(formatErrorMessage(err));
    }
  }

  return {
    session,
    src,
    action,
    setAction,
    error,
    shapes,
    setShapes,
    draftText,
    setDraftText,
    hovered,
    setHovered,
    origin,
    setOrigin,
    current,
    setCurrent,
    handleCancel,
    confirmDraftText,
    commit,
  };
}
