import type { Point } from "./snipGeometry";

export const ANNOTATE_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#10b981",
  "#3b82f6",
  "#ffffff",
] as const;

export const DEFAULT_ANNOTATE_COLOR = ANNOTATE_COLORS[0];

export type AnnotateTool =
  "select" | "pen" | "arrow" | "rect" | "ellipse" | "text" | "pixelate";

export type AnnotShape =
  | {
      id: string;
      kind: "pen";
      color: string;
      points: Point[];
    }
  | {
      id: string;
      kind: "arrow";
      color: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      id: string;
      kind: "rect";
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "ellipse";
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "text";
      color: string;
      x: number;
      y: number;
      text: string;
    }
  | {
      id: string;
      kind: "pixelate";
      x: number;
      y: number;
      width: number;
      height: number;
    };

export interface AnnotCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isDrawTool(tool: AnnotateTool): boolean {
  return tool !== "select";
}

export function nextShapeId(): string {
  return crypto.randomUUID();
}

export function strokeWidthFor(
  imageWidth: number,
  imageHeight: number,
): number {
  return Math.max(4, Math.round(Math.min(imageWidth, imageHeight) / 280));
}

export function fontSizeFor(imageWidth: number, imageHeight: number): number {
  return Math.max(22, Math.round(Math.min(imageWidth, imageHeight) / 32));
}

export function pixelateBlockSize(
  imageWidth: number,
  imageHeight: number,
): number {
  return Math.max(10, Math.round(Math.min(imageWidth, imageHeight) / 90));
}

export function penSvgPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x} ${p.y} L ${p.x + 0.01} ${p.y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y} ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export interface ArrowGeometry {
  shaftEnd: Point;
  head: [Point, Point, Point];
  headPoints: string;
}

export function arrowGeometry(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: number,
): ArrowGeometry | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return null;

  const angle = Math.atan2(dy, dx);
  const headLen = Math.min(Math.max(16, stroke * 4.5), len * 0.75);
  const spread = Math.PI / 6;
  const shaftLen = Math.max(0, len - headLen * 0.75);

  const shaftEnd: Point = {
    x: x1 + Math.cos(angle) * shaftLen,
    y: y1 + Math.sin(angle) * shaftLen,
  };
  const tip: Point = { x: x2, y: y2 };
  const left: Point = {
    x: x2 - headLen * Math.cos(angle - spread),
    y: y2 - headLen * Math.sin(angle - spread),
  };
  const right: Point = {
    x: x2 - headLen * Math.cos(angle + spread),
    y: y2 - headLen * Math.sin(angle + spread),
  };

  return {
    shaftEnd,
    head: [tip, left, right],
    headPoints: `${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`,
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler o print"));
    image.src = src;
  });
}

function drawPen(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  stroke: number,
) {
  if (points.length === 0) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;
  if (points.length === 1) {
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, stroke / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY);
  }
  const last = points[points.length - 1];
  ctx.lineTo(last.x, last.y);
  ctx.stroke();
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  stroke: number,
) {
  const geom = arrowGeometry(x1, y1, x2, y2, stroke);
  if (!geom) return;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = stroke;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(geom.shaftEnd.x, geom.shaftEnd.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(geom.head[0].x, geom.head[0].y);
  ctx.lineTo(geom.head[1].x, geom.head[1].y);
  ctx.lineTo(geom.head[2].x, geom.head[2].y);
  ctx.closePath();
  ctx.fill();
}

export function drawPixelateOnCanvas(
  ctx: CanvasRenderingContext2D,
  source: HTMLCanvasElement | HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  blockSize: number,
) {
  const maxW =
    source instanceof HTMLImageElement
      ? source.naturalWidth || source.width
      : source.width;
  const maxH =
    source instanceof HTMLImageElement
      ? source.naturalHeight || source.height
      : source.height;
  const sx = Math.max(0, Math.min(Math.floor(x), maxW - 1));
  const sy = Math.max(0, Math.min(Math.floor(y), maxH - 1));
  const sw = Math.max(1, Math.min(Math.round(width), maxW - sx));
  const sh = Math.max(1, Math.min(Math.round(height), maxH - sy));

  const cols = Math.max(1, Math.round(sw / blockSize));
  const rows = Math.max(1, Math.round(sh / blockSize));

  const tiny = document.createElement("canvas");
  tiny.width = cols;
  tiny.height = rows;
  const tinyCtx = tiny.getContext("2d");
  if (!tinyCtx) return;
  tinyCtx.drawImage(source, sx, sy, sw, sh, 0, 0, cols, rows);

  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, cols, rows, sx, sy, sw, sh);
  ctx.imageSmoothingEnabled = prevSmoothing;
}

export function drawShapesOnCanvas(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  shapes: AnnotShape[],
  imageWidth: number,
  imageHeight: number,
) {
  const stroke = strokeWidthFor(imageWidth, imageHeight);
  const fontSize = fontSizeFor(imageWidth, imageHeight);
  const blockSize = pixelateBlockSize(imageWidth, imageHeight);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  for (const shape of shapes) {
    if (shape.kind === "pixelate") {
      drawPixelateOnCanvas(
        ctx,
        canvas,
        shape.x,
        shape.y,
        shape.width,
        shape.height,
        blockSize,
      );
    } else if (shape.kind === "pen") {
      drawPen(ctx, shape.points, shape.color, stroke);
    } else if (shape.kind === "arrow") {
      drawArrow(
        ctx,
        shape.x1,
        shape.y1,
        shape.x2,
        shape.y2,
        shape.color,
        stroke,
      );
    } else if (shape.kind === "rect") {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = stroke;
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.kind === "ellipse") {
      const rx = shape.width / 2;
      const ry = shape.height / 2;
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = stroke;
      ctx.beginPath();
      ctx.ellipse(
        shape.x + rx,
        shape.y + ry,
        Math.max(1, rx),
        Math.max(1, ry),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
    } else if (shape.kind === "text" && shape.text.trim()) {
      ctx.font = `700 ${fontSize}px "Archivo Narrow", "Arial Narrow", sans-serif`;
      ctx.lineWidth = Math.max(3, Math.round(stroke * 0.7));
      ctx.strokeStyle = "#0e0e0e";
      ctx.strokeText(shape.text, shape.x, shape.y + fontSize);
      ctx.fillStyle = shape.color;
      ctx.fillText(shape.text, shape.x, shape.y + fontSize);
    }
  }
}

export async function rasterizeAnnotatedPng(
  src: string,
  imageWidth: number,
  imageHeight: number,
  shapes: AnnotShape[],
  crop?: AnnotCrop,
): Promise<Uint8Array> {
  const image = await loadImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = imageWidth;
  canvas.height = imageHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível");
  ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
  drawShapesOnCanvas(ctx, canvas, shapes, imageWidth, imageHeight);

  let out: HTMLCanvasElement = canvas;
  if (crop && crop.width > 0 && crop.height > 0) {
    const x = Math.max(0, Math.min(Math.round(crop.x), imageWidth - 1));
    const y = Math.max(0, Math.min(Math.round(crop.y), imageHeight - 1));
    const width = Math.max(1, Math.min(Math.round(crop.width), imageWidth - x));
    const height = Math.max(
      1,
      Math.min(Math.round(crop.height), imageHeight - y),
    );
    const cropped = document.createElement("canvas");
    cropped.width = width;
    cropped.height = height;
    const cropCtx = cropped.getContext("2d");
    if (!cropCtx) throw new Error("Canvas indisponível");
    cropCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    out = cropped;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    out.toBlob(
      (next) =>
        next ? resolve(next) : reject(new Error("Falha ao gerar o PNG")),
      "image/png",
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}
