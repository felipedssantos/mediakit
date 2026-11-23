import type { RefObject } from "react";

import type { DraftText } from "../../hooks/useSnipSession";
import {
  ANNOTATE_COLOR,
  arrowHeadPoints,
  type AnnotShape,
} from "../../lib/snipAnnotate";
import type { Point, Rect } from "../../lib/snipGeometry";

interface SnipAnnotationsLayerProps {
  width: number;
  height: number;
  shapes: AnnotShape[];
  tool: string;
  origin: Point | null;
  current: Point | null;
  selection: Rect | null;
  stroke: number;
  fontSize: number;
  scaleX: number;
  scaleY: number;
  draftText: DraftText | null;
  textInputRef: RefObject<HTMLInputElement | null>;
  onDraftChange: (value: string) => void;
  onDraftConfirm: () => void;
  onDraftCancel: () => void;
}

export function SnipAnnotationsLayer({
  width,
  height,
  shapes,
  tool,
  origin,
  current,
  selection,
  stroke,
  fontSize,
  scaleX,
  scaleY,
  draftText,
  textInputRef,
  onDraftChange,
  onDraftConfirm,
  onDraftCancel,
}: SnipAnnotationsLayerProps) {
  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox={`0 0 ${width} ${height}`}
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
    </>
  );
}
