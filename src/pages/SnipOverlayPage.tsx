import { useEffect, useRef, useState } from "react";

import { SnipAnnotationsLayer } from "../components/snip/SnipAnnotationsLayer";
import { SnipToolbar, type OverlayTool } from "../components/snip/SnipToolbar";
import { useT } from "../hooks/useLocale";
import { useSnipSession } from "../hooks/useSnipSession";
import {
  fontSizeFor,
  isAnnotateTool,
  nextShapeId,
  strokeWidthFor,
  type AnnotateTool,
} from "../lib/snipAnnotate";
import {
  normalizeRect,
  toImagePoint,
  windowAtPoint,
  windowCrop,
  windowCssRect,
  type Rect,
} from "../lib/snipGeometry";
import type { SnipMode } from "../types/screenshot";

export function SnipOverlayPage() {
  const t = useT();
  const [tool, setTool] = useState<OverlayTool>("window");
  const textInputRef = useRef<HTMLInputElement>(null);

  const {
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
  } = useSnipSession(() => setTool("window"));

  const captureMode = !isAnnotateTool(tool);

  useEffect(() => {
    if (draftText) textInputRef.current?.focus();
  }, [draftText]);

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
      ? t.snip.hintText
      : tool === "arrow"
        ? t.snip.hintArrow
        : t.snip.hintRect
    : tool === "window"
      ? hovered
        ? hovered.title
        : t.snip.hintWindowFallback
      : tool === "region"
        ? t.snip.hintRegion
        : t.snip.hintFullscreen;

  const cursorClass =
    tool === "region" || tool === "rect" || tool === "arrow"
      ? "cursor-crosshair"
      : tool === "text"
        ? "cursor-text"
        : tool === "window"
          ? "cursor-pointer"
          : "cursor-default";

  return (
    <div
      className={`relative h-full w-full overflow-hidden bg-void select-none ${cursorClass}`}
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
        const point = toImagePoint(
          event.clientX,
          event.clientY,
          session.width,
          session.height,
        );
        if (origin && (tool === "region" || isAnnotateTool(tool))) {
          setCurrent(point);
          return;
        }
        if (tool !== "window") {
          setHovered(null);
          return;
        }
        setHovered(windowAtPoint(session, point.x, point.y));
      }}
      onMouseDown={(event) => {
        if (event.button !== 0 || !session) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-snip-toolbar], [data-snip-text]")) return;
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
        if (target.closest("[data-snip-toolbar], [data-snip-text]")) return;
        if (tool === "fullscreen") {
          void commit();
          return;
        }
        if (tool === "window") {
          if (hovered) void commit(windowCrop(session, hovered));
          return;
        }
        if (tool === "text" || !origin || !current) return;
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
        <SnipAnnotationsLayer
          width={session.width}
          height={session.height}
          shapes={shapes}
          tool={tool}
          origin={origin}
          current={current}
          selection={selection}
          stroke={stroke}
          fontSize={fontSize}
          scaleX={scaleX}
          scaleY={scaleY}
          draftText={draftText}
          textInputRef={textInputRef}
          onDraftChange={(value) =>
            setDraftText((prev) => (prev ? { ...prev, value } : prev))
          }
          onDraftConfirm={confirmDraftText}
          onDraftCancel={() => setDraftText(null)}
        />
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

      <SnipToolbar
        tool={tool}
        action={action}
        hint={hint}
        error={error}
        onSelectCapture={selectCaptureTool}
        onSelectAnnotate={selectAnnotateTool}
        onSelectAction={onDestClick}
      />
    </div>
  );
}
