import { useLayoutEffect, useRef, type RefObject } from "react";

import type { DraftText } from "../../hooks/useSnipSession";
import {
  arrowHeadPoints,
  fontSizeFor,
  penSvgPath,
  pixelateBlockSize,
  strokeWidthFor,
  type AnnotShape,
  type AnnotateTool,
} from "../../lib/snipAnnotate";
import type { Point, Rect } from "../../lib/snipGeometry";

interface PixelateBoxProps {
  imageEl: HTMLImageElement | null;
  rect: Rect;
  imageWidth: number;
  imageHeight: number;
  scaleX: number;
  scaleY: number;
}

function PixelateBox({
  imageEl,
  rect,
  imageWidth,
  imageHeight,
  scaleX,
  scaleY,
}: PixelateBoxProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blockSize = pixelateBlockSize(imageWidth, imageHeight);
  const sx = Math.max(0, Math.min(Math.floor(rect.x), imageWidth - 1));
  const sy = Math.max(0, Math.min(Math.floor(rect.y), imageHeight - 1));
  const sw = Math.max(1, Math.min(Math.round(rect.width), imageWidth - sx));
  const sh = Math.max(1, Math.min(Math.round(rect.height), imageHeight - sy));
  const cols = Math.max(1, Math.round(sw / blockSize));
  const rows = Math.max(1, Math.round(sh / blockSize));

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageEl || !imageEl.complete) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, cols, rows);
    ctx.drawImage(imageEl, sx, sy, sw, sh, 0, 0, cols, rows);
  }, [imageEl, sx, sy, sw, sh, cols, rows]);

  return (
    <canvas
      ref={canvasRef}
      width={cols}
      height={rows}
      className="pointer-events-none absolute"
      style={{
        left: sx * scaleX,
        top: sy * scaleY,
        width: sw * scaleX,
        height: sh * scaleY,
        imageRendering: "pixelated",
      }}
    />
  );
}

interface SnipAnnotationsLayerProps {
  imageEl: HTMLImageElement | null;
  width: number;
  height: number;
  selection: Rect;
  shapes: AnnotShape[];
  tool: AnnotateTool;
  color: string;
  drawOrigin: Point | null;
  drawCurrent: Point | null;
  drawRect: Rect | null;
  penPoints: Point[];
  scaleX: number;
  scaleY: number;
  draftText: DraftText | null;
  textInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onDraftConfirm: () => void;
  onDraftCancel: () => void;
}

export function SnipAnnotationsLayer({
  imageEl,
  width,
  height,
  selection,
  shapes,
  tool,
  color,
  drawOrigin,
  drawCurrent,
  drawRect,
  penPoints,
  scaleX,
  scaleY,
  draftText,
  textInputRef,
  onDraftChange,
  onDraftConfirm,
  onDraftCancel,
}: SnipAnnotationsLayerProps) {
  const stroke = strokeWidthFor(width, height);
  const fontSize = fontSizeFor(width, height);
  const pixelates = shapes.filter(
    (s): s is Extract<AnnotShape, { kind: "pixelate" }> =>
      s.kind === "pixelate",
  );

  return (
    <div
      className="pointer-events-none absolute overflow-hidden"
      style={{
        left: selection.x * scaleX,
        top: selection.y * scaleY,
        width: selection.width * scaleX,
        height: selection.height * scaleY,
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          marginLeft: -selection.x * scaleX,
          marginTop: -selection.y * scaleY,
          width: width * scaleX,
          height: height * scaleY,
        }}
      >
        {pixelates.map((shape) => (
          <PixelateBox
            key={shape.id}
            imageEl={imageEl}
            rect={shape}
            imageWidth={width}
            imageHeight={height}
            scaleX={scaleX}
            scaleY={scaleY}
          />
        ))}

        {tool === "pixelate" &&
          drawRect &&
          drawRect.width >= 2 &&
          drawRect.height >= 2 && (
            <>
              <PixelateBox
                imageEl={imageEl}
                rect={drawRect}
                imageWidth={width}
                imageHeight={height}
                scaleX={scaleX}
                scaleY={scaleY}
              />
              <div
                className="pointer-events-none absolute border border-dashed border-white/80"
                style={{
                  left: drawRect.x * scaleX,
                  top: drawRect.y * scaleY,
                  width: drawRect.width * scaleX,
                  height: drawRect.height * scaleY,
                }}
              />
            </>
          )}

        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
        >
          {shapes.map((shape) => {
            if (shape.kind === "pixelate") return null;
            if (shape.kind === "pen") {
              return (
                <path
                  key={shape.id}
                  d={penSvgPath(shape.points)}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            }
            if (shape.kind === "arrow") {
              const head = Math.max(14, stroke * 4);
              return (
                <g key={shape.id}>
                  <line
                    x1={shape.x1}
                    y1={shape.y1}
                    x2={shape.x2}
                    y2={shape.y2}
                    stroke={shape.color}
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
                    fill={shape.color}
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
                  stroke={shape.color}
                  strokeWidth={stroke}
                />
              );
            }
            if (shape.kind === "ellipse") {
              return (
                <ellipse
                  key={shape.id}
                  cx={shape.x + shape.width / 2}
                  cy={shape.y + shape.height / 2}
                  rx={Math.max(1, shape.width / 2)}
                  ry={Math.max(1, shape.height / 2)}
                  fill="none"
                  stroke={shape.color}
                  strokeWidth={stroke}
                />
              );
            }
            return (
              <text
                key={shape.id}
                x={shape.x}
                y={shape.y + fontSize}
                fill={shape.color}
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

          {tool === "pen" && penPoints.length > 0 && (
            <path
              d={penSvgPath(penPoints)}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {tool === "arrow" && drawOrigin && drawCurrent && (
            <g>
              <line
                x1={drawOrigin.x}
                y1={drawOrigin.y}
                x2={drawCurrent.x}
                y2={drawCurrent.y}
                stroke={color}
                strokeWidth={stroke}
                strokeLinecap="round"
              />
              <polygon
                points={arrowHeadPoints(
                  drawOrigin.x,
                  drawOrigin.y,
                  drawCurrent.x,
                  drawCurrent.y,
                  Math.max(14, stroke * 4),
                )}
                fill={color}
              />
            </g>
          )}

          {tool === "rect" && drawRect && (
            <rect
              x={drawRect.x}
              y={drawRect.y}
              width={drawRect.width}
              height={drawRect.height}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
            />
          )}

          {tool === "ellipse" && drawRect && (
            <ellipse
              cx={drawRect.x + drawRect.width / 2}
              cy={drawRect.y + drawRect.height / 2}
              rx={Math.max(1, drawRect.width / 2)}
              ry={Math.max(1, drawRect.height / 2)}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
            />
          )}
        </svg>

        {draftText && (
          <input
            ref={textInputRef}
            data-snip-text
            value={draftText.value}
            onChange={(event) => onDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                onDraftConfirm();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                onDraftCancel();
              }
            }}
            className="pointer-events-auto absolute z-30 rounded border border-accent bg-black/85 px-1.5 outline-none"
            style={{
              left: draftText.x * scaleX,
              top: draftText.y * scaleY,
              color: draftText.color,
              fontFamily: '"Archivo Narrow", "Arial Narrow", sans-serif',
              fontWeight: 700,
              fontSize: fontSize * scaleY,
              width: Math.max(140, 8 * fontSize * scaleX),
            }}
          />
        )}
      </div>
    </div>
  );
}
