import { useCallback, useEffect, useRef, useState } from "react";

import { SnipAnnotationsLayer } from "../components/snip/SnipAnnotationsLayer";
import { SnipToolbar } from "../components/snip/SnipToolbar";
import { useT } from "../hooks/useLocale";
import { useSnipSession } from "../hooks/useSnipSession";
import { isDrawTool, nextShapeId } from "../lib/snipAnnotate";
import {
  clampRect,
  constrainSquarePoint,
  detectHoverTarget,
  isNearMonitorEdge,
  normalizeRect,
  resizeSelectionRect,
  toImagePoint,
  type HoverTarget,
  type Point,
  type Rect,
  type ResizeHandle,
  type ViewportBounds,
} from "../lib/snipGeometry";

const HANDLES: Array<{
  id: ResizeHandle;
  cursor: string;
  pos: string;
}> = [
  { id: "nw", cursor: "cursor-nwse-resize", pos: "-top-1.5 -left-1.5" },
  {
    id: "n",
    cursor: "cursor-ns-resize",
    pos: "-top-1.5 left-1/2 -translate-x-1/2",
  },
  { id: "ne", cursor: "cursor-nesw-resize", pos: "-top-1.5 -right-1.5" },
  {
    id: "e",
    cursor: "cursor-ew-resize",
    pos: "top-1/2 -right-1.5 -translate-y-1/2",
  },
  { id: "se", cursor: "cursor-nwse-resize", pos: "-bottom-1.5 -right-1.5" },
  {
    id: "s",
    cursor: "cursor-ns-resize",
    pos: "-bottom-1.5 left-1/2 -translate-x-1/2",
  },
  { id: "sw", cursor: "cursor-nesw-resize", pos: "-bottom-1.5 -left-1.5" },
  {
    id: "w",
    cursor: "cursor-ew-resize",
    pos: "top-1/2 -left-1.5 -translate-y-1/2",
  },
];

function computeToolbarPosition(
  selection: Rect,
  scaleX: number,
  scaleY: number,
  viewW: number,
  viewH: number,
) {
  const estWidth = Math.min(viewW - 24, 680);
  const estHeight = 46;
  const selLeft = selection.x * scaleX;
  const selTop = selection.y * scaleY;
  const selBottom = (selection.y + selection.height) * scaleY;

  const left = Math.max(12, Math.min(selLeft, viewW - estWidth - 12));
  let top = selBottom + 10;
  if (top + estHeight > viewH - 12) {
    top = selTop - estHeight - 10;
  }
  if (top < 12) {
    top = Math.max(12, viewH - estHeight - 16);
  }
  return { left, top };
}

export function SnipOverlayPage() {
  const t = useT();
  const containerRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const [bounds, setBounds] = useState<ViewportBounds>(() => ({
    left: 0,
    top: 0,
    width: Math.max(window.innerWidth, 1),
    height: Math.max(window.innerHeight, 1),
  }));
  const [loadedImg, setLoadedImg] = useState<HTMLImageElement | null>(null);
  const [hoverTarget, setHoverTarget] = useState<HoverTarget | null>(null);
  const [selectStart, setSelectStart] = useState<Point | null>(null);
  const [selectCurrent, setSelectCurrent] = useState<Point | null>(null);
  const [selectClientOrigin, setSelectClientOrigin] = useState<Point | null>(
    null,
  );
  const [isDraggingSelect, setIsDraggingSelect] = useState(false);

  const [resizeState, setResizeState] = useState<{
    handle: ResizeHandle;
    startPoint: Point;
    startRect: Rect;
  } | null>(null);

  const [drawOrigin, setDrawOrigin] = useState<Point | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<Point | null>(null);
  const [penPoints, setPenPoints] = useState<Point[]>([]);
  const [dragTextState, setDragTextState] = useState<{
    id: string;
    startPoint: Point;
    originX: number;
    originY: number;
  } | null>(null);

  const resetLocalInteractions = useCallback(() => {
    setHoverTarget(null);
    setSelectStart(null);
    setSelectCurrent(null);
    setSelectClientOrigin(null);
    setIsDraggingSelect(false);
    setResizeState(null);
    setDrawOrigin(null);
    setDrawCurrent(null);
    setPenPoints([]);
    setDragTextState(null);
  }, []);

  const {
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
  } = useSnipSession(resetLocalInteractions);

  const isDraftOpen = Boolean(draftText);
  useEffect(() => {
    if (!isDraftOpen) return;
    const id = requestAnimationFrame(() => textInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [isDraftOpen, draftText?.x, draftText?.y]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const sync = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        setBounds({
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        });
      }
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    window.addEventListener("resize", sync);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", sync);
    };
  }, [session]);

  function getBounds(): ViewportBounds {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect && rect.width > 0 && rect.height > 0) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      };
    }
    return bounds;
  }

  const scaleX = session ? bounds.width / Math.max(session.width, 1) : 1;
  const scaleY = session ? bounds.height / Math.max(session.height, 1) : 1;

  const activeSelectRect =
    phase === "selecting" && isDraggingSelect && selectStart && selectCurrent
      ? normalizeRect(selectStart, selectCurrent)
      : null;

  const activeDrawRect =
    phase === "editing" &&
    drawOrigin &&
    drawCurrent &&
    (tool === "rect" || tool === "ellipse" || tool === "pixelate")
      ? normalizeRect(drawOrigin, drawCurrent)
      : null;

  function lockSelection(rect: Rect) {
    if (!session) return;
    const clamped = clampRect(
      {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      session.width,
      session.height,
    );
    setSelection(clamped);
    setPhase("editing");
    setHoverTarget(null);
    setSelectStart(null);
    setSelectCurrent(null);
    setSelectClientOrigin(null);
    setIsDraggingSelect(false);
  }

  function handleMouseMove(event: React.MouseEvent) {
    if (!session) return;
    const b = getBounds();
    const point = toImagePoint(
      event.clientX,
      event.clientY,
      session.width,
      session.height,
      b,
    );

    if (phase === "selecting") {
      if (selectStart && selectClientOrigin) {
        const dist = Math.hypot(
          event.clientX - selectClientOrigin.x,
          event.clientY - selectClientOrigin.y,
        );
        if (dist >= 4 || isDraggingSelect) {
          setIsDraggingSelect(true);
          setSelectCurrent(point);
          setHoverTarget(null);
        }
        return;
      }
      const nearEdge = isNearMonitorEdge(event.clientX, event.clientY, b);
      setHoverTarget(detectHoverTarget(session, point.x, point.y, nearEdge));
      return;
    }

    if (dragTextState) {
      const dx = point.x - dragTextState.startPoint.x;
      const dy = point.y - dragTextState.startPoint.y;
      setShapes((prev) =>
        prev.map((s) =>
          s.id === dragTextState.id && s.kind === "text"
            ? {
                ...s,
                x: dragTextState.originX + dx,
                y: dragTextState.originY + dy,
              }
            : s,
        ),
      );
      return;
    }

    if (resizeState) {
      const dx = point.x - resizeState.startPoint.x;
      const dy = point.y - resizeState.startPoint.y;
      setSelection(
        resizeSelectionRect(
          resizeState.startRect,
          resizeState.handle,
          dx,
          dy,
          session.width,
          session.height,
        ),
      );
      return;
    }

    if (tool === "pen" && penPoints.length > 0) {
      if (event.shiftKey) {
        setPenPoints((prev) => [prev[0], point]);
        return;
      }
      const last = penPoints[penPoints.length - 1];
      if (Math.hypot(point.x - last.x, point.y - last.y) >= 2) {
        setPenPoints((prev) => [...prev, point]);
      }
      return;
    }

    if (drawOrigin && isDrawTool(tool)) {
      const nextPoint =
        event.shiftKey && (tool === "rect" || tool === "ellipse")
          ? constrainSquarePoint(drawOrigin, point)
          : point;
      setDrawCurrent(nextPoint);
    }
  }

  function handleMouseDown(event: React.MouseEvent) {
    if (event.button !== 0 || !session) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-snip-toolbar], [data-snip-text]")) return;

    const b = getBounds();
    const point = toImagePoint(
      event.clientX,
      event.clientY,
      session.width,
      session.height,
      b,
    );

    if (phase === "selecting") {
      setSelectStart(point);
      setSelectCurrent(point);
      setSelectClientOrigin({ x: event.clientX, y: event.clientY });
      setIsDraggingSelect(false);
      return;
    }

    if (phase === "editing" && (tool === "text" || tool === "select")) {
      const textEl = target.closest<SVGTextElement>("[data-snip-shape-id]");
      const dragShapeId = textEl?.dataset.snipShapeId;
      if (dragShapeId) {
        const shape = shapes.find(
          (s): s is Extract<typeof s, { kind: "text" }> =>
            s.id === dragShapeId && s.kind === "text",
        );
        if (shape) {
          event.preventDefault();
          confirmDraftText();
          setDragTextState({
            id: shape.id,
            startPoint: point,
            originX: shape.x,
            originY: shape.y,
          });
          return;
        }
      }
    }

    if (tool === "select" && selection) {
      const handleEl = target.closest<HTMLElement>("[data-snip-handle]");
      const handle =
        (handleEl?.dataset.snipHandle as ResizeHandle | undefined) ??
        (point.x >= selection.x &&
        point.y >= selection.y &&
        point.x <= selection.x + selection.width &&
        point.y <= selection.y + selection.height
          ? "move"
          : null);
      if (handle) {
        setResizeState({
          handle,
          startPoint: point,
          startRect: selection,
        });
      }
      return;
    }

    if (tool === "text") {
      event.preventDefault();
      confirmDraftText();
      setDraftText({ x: point.x, y: point.y, color, value: "" });
      return;
    }

    if (tool === "pen") {
      setPenPoints([point]);
      return;
    }

    if (isDrawTool(tool)) {
      setDrawOrigin(point);
      setDrawCurrent(point);
    }
  }

  function handleMouseUp(event: React.MouseEvent) {
    if (event.button !== 0 || !session) return;
    const target = event.target as HTMLElement;
    if (
      phase === "selecting" &&
      target.closest("[data-snip-toolbar], [data-snip-text]")
    ) {
      return;
    }

    const b = getBounds();
    const point = toImagePoint(
      event.clientX,
      event.clientY,
      session.width,
      session.height,
      b,
    );

    if (phase === "selecting") {
      if (isDraggingSelect && selectStart) {
        const rect = normalizeRect(selectStart, point);
        if (rect.width >= 4 && rect.height >= 4) {
          lockSelection(rect);
          return;
        }
      }
      if (hoverTarget) {
        lockSelection(hoverTarget.rect);
        return;
      }
      const nearEdge = isNearMonitorEdge(event.clientX, event.clientY, b);
      const fallback = detectHoverTarget(session, point.x, point.y, nearEdge);
      lockSelection(fallback.rect);
      return;
    }

    if (dragTextState) {
      setDragTextState(null);
      return;
    }

    if (resizeState) {
      setResizeState(null);
      return;
    }

    if (tool === "pen" && penPoints.length > 0) {
      const finalPoints = event.shiftKey
        ? [penPoints[0], point]
        : [...penPoints, point];
      setPenPoints([]);
      setShapes((prev) => [
        ...prev,
        { id: nextShapeId(), kind: "pen", color, points: finalPoints },
      ]);
      return;
    }

    if (!drawOrigin) return;
    const from = drawOrigin;
    setDrawOrigin(null);
    setDrawCurrent(null);

    if (tool === "arrow") {
      if (Math.hypot(point.x - from.x, point.y - from.y) < 6) return;
      setShapes((prev) => [
        ...prev,
        {
          id: nextShapeId(),
          kind: "arrow",
          color,
          x1: from.x,
          y1: from.y,
          x2: point.x,
          y2: point.y,
        },
      ]);
      return;
    }

    const rect = normalizeRect(
      from,
      event.shiftKey && (tool === "rect" || tool === "ellipse")
        ? constrainSquarePoint(from, point)
        : point,
    );
    if (rect.width < 4 || rect.height < 4) return;
    if (tool === "rect" || tool === "ellipse") {
      setShapes((prev) => [
        ...prev,
        { id: nextShapeId(), kind: tool, color, ...rect },
      ]);
    } else if (tool === "pixelate") {
      setShapes((prev) => [
        ...prev,
        { id: nextShapeId(), kind: "pixelate", ...rect },
      ]);
    }
  }

  const cursorClass =
    phase === "selecting"
      ? "cursor-crosshair"
      : tool === "select"
        ? "cursor-move"
        : tool === "text"
          ? "cursor-text"
          : "cursor-crosshair";

  const previewRect = activeSelectRect ?? hoverTarget?.rect ?? null;
  const toolbarPos =
    phase === "editing" && selection
      ? computeToolbarPosition(
          selection,
          scaleX,
          scaleY,
          bounds.width,
          bounds.height,
        )
      : { left: 16, top: 16 };

  return (
    <div
      ref={containerRef}
      className={`relative h-full w-full overflow-hidden bg-transparent select-none ${cursorClass}`}
      onContextMenu={(event) => {
        event.preventDefault();
        if (draftText) {
          setDraftText(null);
          return;
        }
        if (phase === "editing") {
          resetToSelect();
          return;
        }
        void handleCancel();
      }}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {src && (
        <img
          src={src}
          alt=""
          crossOrigin="anonymous"
          draggable={false}
          onLoad={(event) => setLoadedImg(event.currentTarget)}
          className="pointer-events-none absolute inset-0 h-full w-full object-fill"
        />
      )}

      {phase === "selecting" && !previewRect && (
        <div className="pointer-events-none absolute inset-0 bg-black/30" />
      )}

      {phase === "selecting" && previewRect && (
        <div
          className="pointer-events-none absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.48)]"
          style={{
            left: previewRect.x * scaleX,
            top: previewRect.y * scaleY,
            width: previewRect.width * scaleX,
            height: previewRect.height * scaleY,
          }}
        >
          <span className="mono-num absolute top-2 left-2 rounded-md bg-black/80 px-2 py-0.5 text-[11px] font-medium text-white shadow">
            {activeSelectRect
              ? `${Math.round(previewRect.width)}×${Math.round(previewRect.height)}`
              : hoverTarget?.kind === "fullscreen"
                ? `${t.snip.toolFullscreen} · ${Math.round(previewRect.width)}×${Math.round(previewRect.height)}`
                : hoverTarget?.label
                  ? `${hoverTarget.label} · ${Math.round(previewRect.width)}×${Math.round(previewRect.height)}`
                  : `${Math.round(previewRect.width)}×${Math.round(previewRect.height)}`}
          </span>
        </div>
      )}

      {phase === "selecting" && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-line bg-surface/95 px-4 py-1.5 text-xs font-medium text-ink shadow-lg">
          {t.snip.hintSelecting}
        </p>
      )}

      {phase === "editing" && session && selection && (
        <>
          <SnipAnnotationsLayer
            imageEl={loadedImg}
            width={session.width}
            height={session.height}
            selection={selection}
            shapes={shapes}
            tool={tool}
            color={color}
            drawOrigin={drawOrigin}
            drawCurrent={drawCurrent}
            drawRect={activeDrawRect}
            penPoints={penPoints}
            scaleX={scaleX}
            scaleY={scaleY}
            draftText={draftText}
            textInputRef={textInputRef}
            onDraftChange={(value) =>
              setDraftText((prev) => (prev ? { ...prev, value } : prev))
            }
            onDraftConfirm={() => {
              confirmDraftText();
            }}
            onDraftCancel={() => setDraftText(null)}
          />

          <div
            className="pointer-events-none absolute border-2 border-accent shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
            style={{
              left: selection.x * scaleX,
              top: selection.y * scaleY,
              width: selection.width * scaleX,
              height: selection.height * scaleY,
            }}
          >
            <span className="mono-num absolute -top-6 left-0 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white">
              {Math.round(selection.width)}×{Math.round(selection.height)}
            </span>

            {tool === "select" &&
              HANDLES.map((handle) => (
                <div
                  key={handle.id}
                  data-snip-handle={handle.id}
                  className={`pointer-events-auto absolute h-3 w-3 rounded-xs border border-white bg-accent shadow ${handle.pos} ${handle.cursor}`}
                />
              ))}
          </div>

          <SnipToolbar
            tool={tool}
            color={color}
            canUndo={shapes.length > 0}
            committing={committing}
            error={error}
            style={toolbarPos}
            onSelectTool={(next) => {
              confirmDraftText();
              setTool(next);
            }}
            onSelectColor={(next) => {
              setColor(next);
              if (draftText) {
                setDraftText((prev) =>
                  prev ? { ...prev, color: next } : prev,
                );
              }
            }}
            onUndo={undo}
            onReselect={resetToSelect}
            onCopy={() => void commit("copy")}
            onSave={() => void commit("save")}
            onCancel={() => void handleCancel()}
          />
        </>
      )}
    </div>
  );
}
