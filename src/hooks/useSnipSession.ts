import { useCallback, useEffect, useRef, useState } from "react";

import { pickOutputDirectory } from "../lib/api/files";
import {
  cancelRegionCapture,
  commitSnipCapture,
  getRegionSession,
  onSnipSessionReady,
  onSnipWindowsReady,
  snipFrameSrc,
} from "../lib/api/screenshot";
import { getCurrentWindowLabel } from "../lib/api/window";
import { printFileName } from "../lib/screenshot";
import {
  DEFAULT_ANNOTATE_COLOR,
  nextShapeId,
  rasterizeAnnotatedPng,
  type AnnotShape,
  type AnnotateTool,
} from "../lib/snipAnnotate";
import type { Rect } from "../lib/snipGeometry";
import type { RegionSession } from "../types/screenshot";
import { formatErrorMessage } from "./createJobQueueStore";
import { useLocale } from "./useLocale";
import { useScreenshotSettings } from "./useScreenshotSettings";
import { useTheme } from "./useTheme";

export interface DraftText {
  x: number;
  y: number;
  color: string;
  value: string;
}

export type SnipPhase = "selecting" | "editing";

const overlayLabel = getCurrentWindowLabel();

const TOOL_HOTKEYS: Record<string, AnnotateTool> = {
  "1": "select",
  "2": "pen",
  "3": "arrow",
  "4": "rect",
  "5": "ellipse",
  "6": "text",
  "7": "pixelate",
};

export function useSnipSession(onSessionReset: () => void) {
  const [session, setSession] = useState<RegionSession | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [phase, setPhase] = useState<SnipPhase>("selecting");
  const [selection, setSelection] = useState<Rect | null>(null);
  const [tool, setTool] = useState<AnnotateTool>("select");
  const [color, setColor] = useState<string>(DEFAULT_ANNOTATE_COLOR);
  const [shapes, setShapes] = useState<AnnotShape[]>([]);
  const [draftText, setDraftText] = useState<DraftText | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const outputDir = useScreenshotSettings((state) => state.outputDir);
  const setOutputDir = useScreenshotSettings((state) => state.setOutputDir);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);

  const finishedRef = useRef(false);
  const lastSessionIdRef = useRef<number | null>(null);
  const shapesRef = useRef(shapes);
  const draftTextRef = useRef(draftText);
  const selectionRef = useRef(selection);
  const phaseRef = useRef(phase);
  const sessionRef = useRef(session);
  const srcRef = useRef(src);
  const resetRef = useRef(onSessionReset);

  useEffect(() => {
    shapesRef.current = shapes;
    draftTextRef.current = draftText;
    selectionRef.current = selection;
    phaseRef.current = phase;
    sessionRef.current = session;
    srcRef.current = src;
    resetRef.current = onSessionReset;
  }, [shapes, draftText, selection, phase, session, src, onSessionReset]);

  useEffect(() => {
    let cancelled = false;
    let unlistenSession: (() => void) | undefined;
    let unlistenWindows: (() => void) | undefined;

    function applySession(next: RegionSession) {
      if (next.overlay_label && next.overlay_label !== overlayLabel) return;
      if (lastSessionIdRef.current === next.session_id) return;
      lastSessionIdRef.current = next.session_id;
      useTheme.getState().syncFromStorage();
      useLocale.getState().syncFromStorage();
      finishedRef.current = false;
      setCommitting(false);
      setError(null);
      setPhase("selecting");
      setSelection(null);
      setTool("select");
      setShapes([]);
      setDraftText(null);
      resetRef.current();
      setSession(next);
      setSrc(snipFrameSrc(next.path));
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

  const handleCancel = useCallback(async () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    try {
      await cancelRegionCapture();
    } catch {
      finishedRef.current = false;
    }
  }, []);

  const confirmDraftText = useCallback((): AnnotShape[] => {
    const draft = draftTextRef.current;
    if (!draft) return shapesRef.current;
    const text = draft.value.trim();
    setDraftText(null);
    draftTextRef.current = null;
    if (!text) return shapesRef.current;
    const added: AnnotShape = {
      id: nextShapeId(),
      kind: "text",
      color: draft.color,
      x: draft.x,
      y: draft.y,
      text,
    };
    const next = [...shapesRef.current, added];
    shapesRef.current = next;
    setShapes(next);
    return next;
  }, []);

  const resetToSelect = useCallback(() => {
    setDraftText(null);
    setShapes([]);
    setSelection(null);
    setTool("select");
    setPhase("selecting");
    setError(null);
    resetRef.current();
  }, []);

  const undo = useCallback(() => {
    setShapes((current) => current.slice(0, -1));
  }, []);

  const commit = useCallback(
    async (action: "copy" | "save") => {
      const activeSession = sessionRef.current;
      const activeSrc = srcRef.current;
      if (!activeSession || !activeSrc || finishedRef.current) return;

      const allShapes = confirmDraftText();
      const crop = selectionRef.current ?? {
        x: 0,
        y: 0,
        width: activeSession.width,
        height: activeSession.height,
      };

      let destDir = outputDir;
      if (action === "save" && !destDir) {
        const directory = await pickOutputDirectory();
        if (!directory) return;
        destDir = directory;
        setOutputDir(directory);
      }

      finishedRef.current = true;
      setCommitting(true);
      setError(null);
      try {
        const png =
          allShapes.length > 0
            ? await rasterizeAnnotatedPng(
                activeSrc,
                activeSession.width,
                activeSession.height,
                allShapes,
                crop,
              )
            : undefined;
        await commitSnipCapture({
          action,
          x: png ? undefined : Math.round(crop.x),
          y: png ? undefined : Math.round(crop.y),
          width: png ? undefined : Math.round(crop.width),
          height: png ? undefined : Math.round(crop.height),
          destDir,
          fileName: printFileName(),
          png,
        });
      } catch (err) {
        finishedRef.current = false;
        setCommitting(false);
        setError(formatErrorMessage(err));
      }
    },
    [confirmDraftText, outputDir, setOutputDir],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (draftTextRef.current) {
          setDraftText(null);
          return;
        }
        void handleCancel();
        return;
      }

      if (draftTextRef.current) return;

      const mod = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (mod && key === "z") {
        event.preventDefault();
        undo();
        return;
      }

      if (phaseRef.current !== "editing") return;

      if (event.key === "Enter" || (mod && key === "c")) {
        event.preventDefault();
        void commit("copy");
        return;
      }

      if (mod && key === "s") {
        event.preventDefault();
        void commit("save");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        resetToSelect();
        return;
      }

      if (!mod && !event.altKey && !event.shiftKey && TOOL_HOTKEYS[event.key]) {
        event.preventDefault();
        setTool(TOOL_HOTKEYS[event.key]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [commit, handleCancel, resetToSelect, undo]);

  return {
    session,
    src,
    phase,
    setPhase,
    selection,
    setSelection,
    tool,
    setTool,
    color,
    setColor,
    shapes,
    setShapes,
    draftText,
    setDraftText,
    error,
    committing,
    handleCancel,
    confirmDraftText,
    resetToSelect,
    undo,
    commit,
  };
}
