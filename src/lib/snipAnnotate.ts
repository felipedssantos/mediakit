export const ANNOTATE_COLOR = "#d1442a";

export type AnnotateTool = "arrow" | "rect" | "text";

export type AnnotShape =
  | {
      id: string;
      kind: "arrow";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
    }
  | {
      id: string;
      kind: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "text";
      x: number;
      y: number;
      text: string;
    };

export interface AnnotCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function isAnnotateTool(tool: string): tool is AnnotateTool {
  return tool === "arrow" || tool === "rect" || tool === "text";
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

export function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  head: number,
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const ax = x2 - head * Math.cos(angle - Math.PI / 7);
  const ay = y2 - head * Math.sin(angle - Math.PI / 7);
  const bx = x2 - head * Math.cos(angle + Math.PI / 7);
  const by = y2 - head * Math.sin(angle + Math.PI / 7);
  return `${x2},${y2} ${ax},${ay} ${bx},${by}`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Não foi possível ler o print"));
    image.src = src;
  });
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  stroke: number,
) {
  const head = Math.max(14, stroke * 4);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const shorten = head * 0.55;
  const tx = x2 - Math.cos(angle) * shorten;
  const ty = y2 - Math.sin(angle) * shorten;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(angle - Math.PI / 7),
    y2 - head * Math.sin(angle - Math.PI / 7),
  );
  ctx.lineTo(
    x2 - head * Math.cos(angle + Math.PI / 7),
    y2 - head * Math.sin(angle + Math.PI / 7),
  );
  ctx.closePath();
  ctx.fill();
}

function drawShapes(
  ctx: CanvasRenderingContext2D,
  shapes: AnnotShape[],
  imageWidth: number,
  imageHeight: number,
) {
  const stroke = strokeWidthFor(imageWidth, imageHeight);
  const fontSize = fontSizeFor(imageWidth, imageHeight);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = ANNOTATE_COLOR;
  ctx.fillStyle = ANNOTATE_COLOR;
  ctx.lineWidth = stroke;

  for (const shape of shapes) {
    if (shape.kind === "arrow") {
      drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2, stroke);
    } else if (shape.kind === "rect") {
      ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
    } else if (shape.kind === "text" && shape.text.trim()) {
      ctx.font = `700 ${fontSize}px "Archivo Narrow", "Arial Narrow", sans-serif`;
      ctx.lineWidth = Math.max(3, Math.round(stroke * 0.7));
      ctx.strokeStyle = "#0e0e0e";
      ctx.strokeText(shape.text, shape.x, shape.y + fontSize);
      ctx.fillStyle = ANNOTATE_COLOR;
      ctx.fillText(shape.text, shape.x, shape.y + fontSize);
      ctx.strokeStyle = ANNOTATE_COLOR;
      ctx.fillStyle = ANNOTATE_COLOR;
      ctx.lineWidth = stroke;
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
  drawShapes(ctx, shapes, imageWidth, imageHeight);

  let out: HTMLCanvasElement = canvas;
  if (crop && crop.width > 0 && crop.height > 0) {
    const x = Math.max(0, Math.min(crop.x, imageWidth - 1));
    const y = Math.max(0, Math.min(crop.y, imageHeight - 1));
    const width = Math.max(1, Math.min(crop.width, imageWidth - x));
    const height = Math.max(1, Math.min(crop.height, imageHeight - y));
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
