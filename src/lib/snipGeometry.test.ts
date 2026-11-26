import { describe, expect, it } from "vitest";

import type { RegionSession } from "../types/screenshot";
import {
  clampRect,
  constrainSquarePoint,
  detectHoverTarget,
  isNearMonitorEdge,
  normalizeRect,
  resizeSelectionRect,
  toImagePoint,
} from "./snipGeometry";

const session: RegionSession = {
  session_id: 1,
  overlay_label: "snip-overlay",
  path: "1_snip-overlay",
  width: 1920,
  height: 1080,
  monitor_x: 0,
  monitor_y: 0,
  windows: [
    {
      id: 10,
      title: "Browser",
      app_name: "chrome",
      x: 100,
      y: 80,
      width: 800,
      height: 600,
    },
    {
      id: 20,
      title: "Editor",
      app_name: "code",
      x: 50,
      y: 50,
      width: 1200,
      height: 900,
    },
  ],
};

describe("snipGeometry", () => {
  it("normalizes drag coordinates in any direction", () => {
    expect(normalizeRect({ x: 300, y: 200 }, { x: 100, y: 50 })).toEqual({
      x: 100,
      y: 50,
      width: 200,
      height: 150,
    });
  });

  it("constrains drag endpoint to a 1:1 square in all quadrants", () => {
    expect(
      normalizeRect(
        { x: 100, y: 100 },
        constrainSquarePoint({ x: 100, y: 100 }, { x: 180, y: 130 }),
      ),
    ).toEqual({ x: 100, y: 100, width: 80, height: 80 });

    expect(
      normalizeRect(
        { x: 100, y: 100 },
        constrainSquarePoint({ x: 100, y: 100 }, { x: 40, y: 20 }),
      ),
    ).toEqual({ x: 20, y: 20, width: 80, height: 80 });
  });

  it("maps client coordinates using viewport bounds (HiDPI-safe)", () => {
    const point = toImagePoint(760, 440, 2560, 1440, {
      left: 120,
      top: 80,
      width: 1280,
      height: 720,
    });
    expect(point).toEqual({ x: 1280, y: 720 });
  });

  it("detects proximity to any monitor edge", () => {
    const bounds = { left: 0, top: 0, width: 1280, height: 720 };
    expect(isNearMonitorEdge(5, 300, bounds)).toBe(true);
    expect(isNearMonitorEdge(1275, 300, bounds)).toBe(true);
    expect(isNearMonitorEdge(500, 8, bounds)).toBe(true);
    expect(isNearMonitorEdge(500, 712, bounds)).toBe(true);
    expect(isNearMonitorEdge(500, 300, bounds)).toBe(false);
  });

  it("selects fullscreen near edge even when hovering over a window", () => {
    const target = detectHoverTarget(session, 200, 200, true);
    expect(target.kind).toBe("fullscreen");
    expect(target.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
  });

  it("picks topmost matching window when inside bounds and not near edge", () => {
    const target = detectHoverTarget(session, 200, 200, false);
    expect(target.kind).toBe("window");
    expect(target.label).toBe("Browser");
    expect(target.rect).toEqual({ x: 100, y: 80, width: 800, height: 600 });
  });

  it("falls back to fullscreen when hovering empty desktop", () => {
    const target = detectHoverTarget(session, 1800, 1000, false);
    expect(target.kind).toBe("fullscreen");
  });

  it("resizes and clamps selection handles within monitor bounds", () => {
    const start = { x: 100, y: 100, width: 400, height: 300 };
    expect(resizeSelectionRect(start, "se", 50, -40, 1920, 1080)).toEqual({
      x: 100,
      y: 100,
      width: 450,
      height: 260,
    });
    expect(resizeSelectionRect(start, "nw", -200, -200, 1920, 1080)).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 400,
    });
    expect(
      clampRect({ x: -10, y: 1000, width: 500, height: 200 }, 1920, 1080),
    ).toEqual({
      x: 0,
      y: 1000,
      width: 500,
      height: 80,
    });
  });
});
