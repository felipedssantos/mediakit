import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState } from "react";
import {
  AppWindow,
  ArrowUpRight,
  Copy,
  Crop,
  Monitor,
  Save,
  Square,
  Type,
} from "lucide-react";

import {
  ANNOTATE_COLOR,
  arrowHeadPoints,
  fontSizeFor,
  isAnnotateTool,
  nextShapeId,
  rasterizeAnnotatedPng,
  strokeWidthFor,
  type AnnotShape,
  type AnnotateTool,
} from "../lib/snipAnnotate";
import { useScreenshotSettings } from "../hooks/useScreenshotSettings";
import { pickOutputDirectory } from "../lib/tauri";
import {
  cancelRegionCapture,
  commitSnipCapture,
  getRegionSession,
  onSnipSessionReady,
  onSnipWindowsReady,
  printFileName,
  screenshotSrc,
} from "../lib/screenshot";
import type {
  RegionSession,
  ScreenshotWindowInfo,
  SnipMode,
} from "../types/screenshot";

type OverlayTool = SnipMode | AnnotateTool;

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Point {
  x: number;
  y: number;
}

interface DraftText {
  x: number;
  y: number;
  value: string;
}

function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function toImagePoint(
  clientX: number,
  clientY: number,
  imageWidth: number,
  imageHeight: number,
): Point {
  return {
    x: (clientX / Math.max(window.innerWidth, 1)) * imageWidth,
    y: (clientY / Math.max(window.innerHeight, 1)) * imageHeight,
  };
}

function windowAtPoint(
  session: RegionSession,
  imageX: number,
  imageY: number,
): ScreenshotWindowInfo | null {
  const screenX = session.monitor_x + imageX;
  const screenY = session.monitor_y + imageY;
  return (
    session.windows.find(
      (item) =>
        screenX >= item.x &&
        screenY >= item.y &&
        screenX < item.x + item.width &&
        screenY < item.y + item.height,
    ) ?? null
  );
}

function windowCssRect(session: RegionSession, item: ScreenshotWindowInfo) {
  const scaleX = window.innerWidth / Math.max(session.width, 1);
  const scaleY = window.innerHeight / Math.max(session.height, 1);
  return {
    left: (item.x - session.monitor_x) * scaleX,
    top: (item.y - session.monitor_y) * scaleY,
    width: item.width * scaleX,
    height: item.height * scaleY,
  };
}

function windowCrop(session: RegionSession, item: ScreenshotWindowInfo): Rect {
  const x = Math.max(0, item.x - session.monitor_x);
  const y = Math.max(0, item.y - session.monitor_y);
  return {
    x,
    y,
    width: Math.min(item.width, session.width - x),
    height: Math.min(item.height, session.height - y),
  };
}

const modeBtn = "stamp inline-flex items-center gap-1.5 border px-2.5 py-1.5";

const overlayLabel = getCurrentWindow().label;

export function SnipOverlayPage() {
  const [session, setSession] = useState<RegionSession | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [tool, setTool] = useState<OverlayTool>("window");
  const [action, setAction] = useState<"copy" | "save">("copy");
  const outputDir = useScreenshotSettings((state) => state.outputDir);
  const setOutputDir = useScreenshotSettings((state) => state.setOutputDir);
  const hydrateSettings = useScreenshotSettings((state) => state.hydrate);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<ScreenshotWindowInfo | null>(null);
  const [origin, setOrigin] = useState<Point | null>(null);
  const [current, setCurrent] = useState<Point | null>(null);
  const [shapes, setShapes] = useState<AnnotShape[]>([]);
  const [draftText, setDraftText] = useState<DraftText | null>(null);
  const finished = useRef(false);
  const textInputRef = useRef<HTMLInputElement>(null);
  const shapesRef = useRef(shapes);
  const draftTextRef = useRef(draftText);
  shapesRef.current = shapes;
  draftTextRef.current = draftText;

  const captureMode = !isAnnotateTool(tool);

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
      setTool("window");
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

  useEffect(() => {
    if (draftText) textInputRef.current?.focus();
  }, [draftText]);

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

  async function handleCancel() {
    if (finished.current) return;
    finished.current = true;
    try {
      await cancelRegionCapture();
    } catch {
      finished.current = false;
    }
  }

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
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function finishRegion(rect: Rect) {
    if (!session) return;
    if (rect.width < 3 || rect.height < 3) {
      setOrigin(null);
      setCurrent(null);
      return;
    }
    await commit({
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    });
  }

  function selectCaptureTool(next: SnipMode) {
    confirmDraftText();
    setTool(next);
    setOrigin(null);
    setCurrent(null);
    if (next !== "window") setHovered(null);
  }

  function selectAnnotateTool(next: AnnotateTool) {
    confirmDraftText();
    setTool(next);
    setOrigin(null);
    setCurrent(null);
    setHovered(null);
  }

  function onDestClick(next: "copy" | "save") {
    setAction(next);
    if (isAnnotateTool(tool)) void commit(undefined, next);
  }

  const selection =
    origin && current && (tool === "region" || tool === "rect")
      ? normalizeRect(origin, current)
      : null;
  const hoverRect =
    tool === "window" && hovered && session
      ? windowCssRect(session, hovered)
      : null;
  const stroke = session ? strokeWidthFor(session.width, session.height) : 6;
  const fontSize = session ? fontSizeFor(session.width, session.height) : 28;
  const scaleX = session ? window.innerWidth / Math.max(session.width, 1) : 1;
  const scaleY = session ? window.innerHeight / Math.max(session.height, 1) : 1;

  const hint = isAnnotateTool(tool)
    ? tool === "text"
      ? "Clique para escrever · Enter confirma"
      : tool === "arrow"
        ? "Arraste para a seta"
        : "Arraste para o quadrado"
    : tool === "window"
      ? hovered
        ? hovered.title
        : "Passe o mouse e clique na janela"
      : tool === "region"
        ? "Arraste para selecionar a área"
        : "Clique para capturar a tela toda";

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-void select-none ${
        tool === "region" || tool === "rect" || tool === "arrow"
          ? "cursor-crosshair"
          : tool === "text"
            ? "cursor-text"
            : tool === "window"
              ? "cursor-pointer"
              : "cursor-default"
      }`}
      onContextMenu={(event) => {
        event.preventDefault();
        if (draftText) {
          setDraftText(null);
          return;
        }
        void handleCancel();
      }}
      onMouseMove={(event) => {
        if (!session) return;
        if (origin && (tool === "region" || isAnnotateTool(tool))) {
          setCurrent(
            toImagePoint(
              event.clientX,
              event.clientY,
              session.width,
              session.height,
            ),
          );
          return;
        }
        if (tool !== "window") {
          setHovered(null);
          return;
        }
        const point = toImagePoint(
          event.clientX,
          event.clientY,
          session.width,
          session.height,
        );
        setHovered(windowAtPoint(session, point.x, point.y));
      }}
      onMouseDown={(event) => {
        if (event.button !== 0 || !session) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-snip-toolbar]")) return;
        if (target.closest("[data-snip-text]")) return;
        const point = toImagePoint(
          event.clientX,
          event.clientY,
          session.width,
          session.height,
        );
        if (tool === "text") {
          confirmDraftText();
          setDraftText({ x: point.x, y: point.y, value: "" });
          return;
        }
        if (tool === "region" || tool === "arrow" || tool === "rect") {
          setOrigin(point);
          setCurrent(point);
        }
      }}
      onMouseUp={(event) => {
        if (event.button !== 0 || !session) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-snip-toolbar]")) return;
        if (target.closest("[data-snip-text]")) return;
        if (tool === "fullscreen") {
          void commit();
          return;
        }
        if (tool === "window") {
          if (hovered) void commit(windowCrop(session, hovered));
          return;
        }
        if (tool === "text") return;
        if (!origin || !current) return;
        const from = origin;
        const to = toImagePoint(
          event.clientX,
          event.clientY,
          session.width,
          session.height,
        );
        setOrigin(null);
        setCurrent(null);
        if (tool === "arrow") {
          if (Math.hypot(to.x - from.x, to.y - from.y) < 8) return;
          setShapes((currentShapes) => [
            ...currentShapes,
            {
              id: nextShapeId(),
              kind: "arrow",
              x1: from.x,
              y1: from.y,
              x2: to.x,
              y2: to.y,
            },
          ]);
          return;
        }
        if (tool === "rect") {
          const rect = normalizeRect(from, to);
          if (rect.width < 4 || rect.height < 4) return;
          setShapes((currentShapes) => [
            ...currentShapes,
            { id: nextShapeId(), kind: "rect", ...rect },
          ]);
          return;
        }
        void finishRegion(normalizeRect(from, to));
      }}
    >
      {src && (
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
      )}

      {session && (
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${session.width} ${session.height}`}
          preserveAspectRatio="none"
        >
          {shapes.map((shape) => {
            if (shape.kind === "arrow") {
              const head = Math.max(14, stroke * 4);
              return (
                <g key={shape.id}>
                  <line
                    x1={shape.x1}
                    y1={shape.y1}
                    x2={shape.x2}
                    y2={shape.y2}
                    stroke={ANNOTATE_COLOR}
                    strokeWidth={stroke}
                    strokeLinecap="round"
                  />
                  <polygon
                    points={arrowHeadPoints(
                      shape.x1,
                      shape.y1,
                      shape.x2,
                      shape.y2,
                      head,
                    )}
                    fill={ANNOTATE_COLOR}
                  />
                </g>
              );
            }
            if (shape.kind === "rect") {
              return (
                <rect
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.width}
                  height={shape.height}
                  fill="none"
                  stroke={ANNOTATE_COLOR}
                  strokeWidth={stroke}
                />
              );
            }
            return (
              <text
                key={shape.id}
                x={shape.x}
                y={shape.y + fontSize}
                fill={ANNOTATE_COLOR}
                stroke="#0e0e0e"
                strokeWidth={Math.max(2, stroke * 0.35)}
                paintOrder="stroke"
                fontFamily="Archivo Narrow, Arial Narrow, sans-serif"
                fontWeight={700}
                fontSize={fontSize}
              >
                {shape.text}
              </text>
            );
          })}
          {tool === "arrow" && origin && current && (
            <g>
              <line
                x1={origin.x}
                y1={origin.y}
                x2={current.x}
                y2={current.y}
                stroke={ANNOTATE_COLOR}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              <polygon
                points={arrowHeadPoints(
                  origin.x,
                  origin.y,
                  current.x,
                  current.y,
                  Math.max(14, stroke * 4),
                )}
                fill={ANNOTATE_COLOR}
              />
            </g>
          )}
          {tool === "rect" && selection && (
            <rect
              x={selection.x}
              y={selection.y}
              width={selection.width}
              height={selection.height}
              fill="none"
              stroke={ANNOTATE_COLOR}
              strokeWidth={stroke}
            />
          )}
        </svg>
      )}

      {captureMode && !selection && (
        <div className="pointer-events-none absolute inset-0 bg-void/20" />
      )}

      {hoverRect && (
        <div
          className="pointer-events-none absolute border-2 border-lamp shadow-[0_0_0_9999px_rgba(14,14,14,0.45)]"
          style={hoverRect}
        />
      )}

      {tool === "region" && selection && (
        <div
          className="pointer-events-none absolute border border-lamp bg-transparent shadow-[0_0_0_9999px_rgba(14,14,14,0.55)]"
          style={{
            left: selection.x * scaleX,
            top: selection.y * scaleY,
            width: selection.width * scaleX,
            height: selection.height * scaleY,
          }}
        />
      )}

      {draftText && session && (
        <input
          ref={textInputRef}
          data-snip-text
          value={draftText.value}
          onChange={(event) =>
            setDraftText((currentDraft) =>
              currentDraft
                ? { ...currentDraft, value: event.target.value }
                : currentDraft,
            )
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              confirmDraftText();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              setDraftText(null);
            }
          }}
          className="absolute z-20 border border-fault bg-void/90 px-1 text-fault outline-none"
          style={{
            left: draftText.x * scaleX,
            top: draftText.y * scaleY,
            fontFamily: '"Archivo Narrow", "Arial Narrow", sans-serif',
            fontWeight: 700,
            fontSize: fontSize * scaleY,
            width: Math.max(120, 8 * fontSize * scaleX),
          }}
        />
      )}

      <div
        data-snip-toolbar
        className="absolute top-4 left-1/2 z-10 flex max-w-[calc(100%-2rem)] -translate-x-1/2 flex-wrap items-center justify-center gap-1 border border-rule bg-void/90 p-1"
      >
        <button
          type="button"
          className={`${modeBtn} ${tool === "fullscreen" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectCaptureTool("fullscreen")}
        >
          <Monitor size={12} />
          Tela
        </button>
        <button
          type="button"
          className={`${modeBtn} ${tool === "window" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectCaptureTool("window")}
        >
          <AppWindow size={12} />
          Janela
        </button>
        <button
          type="button"
          className={`${modeBtn} ${tool === "region" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectCaptureTool("region")}
        >
          <Crop size={12} />
          Área
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          className={`${modeBtn} ${tool === "arrow" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectAnnotateTool("arrow")}
        >
          <ArrowUpRight size={12} />
          Seta
        </button>
        <button
          type="button"
          className={`${modeBtn} ${tool === "rect" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectAnnotateTool("rect")}
        >
          <Square size={12} />
          Quadrado
        </button>
        <button
          type="button"
          className={`${modeBtn} ${tool === "text" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => selectAnnotateTool("text")}
        >
          <Type size={12} />
          Texto
        </button>
        <span className="mx-1 h-4 w-px bg-rule" />
        <button
          type="button"
          className={`${modeBtn} ${action === "copy" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => onDestClick("copy")}
        >
          <Copy size={12} />
          Copiar
        </button>
        <button
          type="button"
          className={`${modeBtn} ${action === "save" ? "border-lamp text-lamp" : "border-steel-dim text-paint-dim hover:text-lamp"}`}
          onClick={() => onDestClick("save")}
        >
          <Save size={12} />
          Salvar
        </button>
      </div>

      <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 stamp bg-void/80 px-3 py-1.5 text-paint">
        {hint}
        {isAnnotateTool(tool)
          ? " · Copiar ou Salvar confirma · Ctrl+Z desfaz"
          : action === "copy"
            ? " · copia na hora"
            : " · salva na pasta"}
        {" · Esc cancela"}
      </p>

      {error && (
        <p className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 bg-void/80 px-3 py-1.5 text-sm text-fault">
          {error}
        </p>
      )}
    </div>
  );
}
