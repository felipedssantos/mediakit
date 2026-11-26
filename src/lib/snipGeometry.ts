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

export interface ViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HoverTarget {
  kind: "fullscreen" | "window";
  rect: Rect;
  label?: string;
}

export type ResizeHandle =
  "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se" | "move";

export const EDGE_SNAP_PX = 12;

export function constrainSquarePoint(origin: Point, current: Point): Point {
  const dx = current.x - origin.x;
  const dy = current.y - origin.y;
  const size = Math.max(Math.abs(dx), Math.abs(dy));
  return {
    x: origin.x + (dx < 0 ? -size : size),
    y: origin.y + (dy < 0 ? -size : size),
  };
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

export function clampRect(rect: Rect, maxW: number, maxH: number): Rect {
  const x = Math.max(0, Math.min(rect.x, Math.max(0, maxW - 1)));
  const y = Math.max(0, Math.min(rect.y, Math.max(0, maxH - 1)));
  const width = Math.max(1, Math.min(rect.width, maxW - x));
  const height = Math.max(1, Math.min(rect.height, maxH - y));
  return { x, y, width, height };
}

export function toImagePoint(
  clientX: number,
  clientY: number,
  imageWidth: number,
  imageHeight: number,
  bounds?: ViewportBounds,
): Point {
  const left = bounds?.left ?? 0;
  const top = bounds?.top ?? 0;
  const viewW = Math.max(bounds?.width ?? window.innerWidth, 1);
  const viewH = Math.max(bounds?.height ?? window.innerHeight, 1);
  const rx = Math.max(0, Math.min(1, (clientX - left) / viewW));
  const ry = Math.max(0, Math.min(1, (clientY - top) / viewH));
  return {
    x: rx * imageWidth,
    y: ry * imageHeight,
  };
}

export function isNearMonitorEdge(
  clientX: number,
  clientY: number,
  bounds: ViewportBounds,
  margin = EDGE_SNAP_PX,
): boolean {
  const relX = clientX - bounds.left;
  const relY = clientY - bounds.top;
  return (
    relX <= margin ||
    relY <= margin ||
    bounds.width - relX <= margin ||
    bounds.height - relY <= margin
  );
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

export function windowCrop(
  session: RegionSession,
  item: ScreenshotWindowInfo,
): Rect {
  const left = Math.max(0, item.x - session.monitor_x);
  const top = Math.max(0, item.y - session.monitor_y);
  const right = Math.min(
    session.width,
    item.x + item.width - session.monitor_x,
  );
  const bottom = Math.min(
    session.height,
    item.y + item.height - session.monitor_y,
  );
  return {
    x: left,
    y: top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };
}

export function detectHoverTarget(
  session: RegionSession,
  imageX: number,
  imageY: number,
  nearEdge: boolean,
): HoverTarget {
  const fullRect: Rect = {
    x: 0,
    y: 0,
    width: session.width,
    height: session.height,
  };
  if (nearEdge) {
    return { kind: "fullscreen", rect: fullRect };
  }
  const win = windowAtPoint(session, imageX, imageY);
  if (win) {
    return {
      kind: "window",
      rect: windowCrop(session, win),
      label: win.title,
    };
  }
  return { kind: "fullscreen", rect: fullRect };
}

export function resizeSelectionRect(
  start: Rect,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  maxW: number,
  maxH: number,
  minSize = 8,
): Rect {
  if (handle === "move") {
    const x = Math.max(0, Math.min(maxW - start.width, start.x + dx));
    const y = Math.max(0, Math.min(maxH - start.height, start.y + dy));
    return { ...start, x, y };
  }

  let left = start.x;
  let top = start.y;
  let right = start.x + start.width;
  let bottom = start.y + start.height;

  if (handle.includes("w")) {
    left = Math.max(0, Math.min(right - minSize, start.x + dx));
  }
  if (handle.includes("e")) {
    right = Math.min(
      maxW,
      Math.max(left + minSize, start.x + start.width + dx),
    );
  }
  if (handle.includes("n")) {
    top = Math.max(0, Math.min(bottom - minSize, start.y + dy));
  }
  if (handle.includes("s")) {
    bottom = Math.min(
      maxH,
      Math.max(top + minSize, start.y + start.height + dy),
    );
  }

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}
