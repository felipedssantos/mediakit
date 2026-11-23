import type { RegionSession, ScreenshotWindowInfo } from "../types/screenshot";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export function normalizeRect(a: Point, b: Point): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function toImagePoint(
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

export function windowAtPoint(
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

export function windowCssRect(session: RegionSession, item: ScreenshotWindowInfo) {
  const scaleX = window.innerWidth / Math.max(session.width, 1);
  const scaleY = window.innerHeight / Math.max(session.height, 1);
  return {
    left: (item.x - session.monitor_x) * scaleX,
    top: (item.y - session.monitor_y) * scaleY,
    width: item.width * scaleX,
    height: item.height * scaleY,
  };
}

export function windowCrop(session: RegionSession, item: ScreenshotWindowInfo): Rect {
  const x = Math.max(0, item.x - session.monitor_x);
  const y = Math.max(0, item.y - session.monitor_y);
  return {
    x,
    y,
    width: Math.min(item.width, session.width - x),
    height: Math.min(item.height, session.height - y),
  };
}
