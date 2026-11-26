import { describe, expect, it } from "vitest";

import {
  arrowGeometry,
  penSvgPath,
  pixelateBlockSize,
  strokeWidthFor,
} from "./snipAnnotate";

describe("snipAnnotate", () => {
  it("builds smooth quadratic SVG path for freehand pen strokes", () => {
    expect(penSvgPath([])).toBe("");
    expect(penSvgPath([{ x: 10, y: 20 }])).toBe("M 10 20 L 10.01 20");
    expect(
      penSvgPath([
        { x: 0, y: 0 },
        { x: 120, y: 45 },
      ]),
    ).toBe("M 0 0 L 120 45");
    expect(
      penSvgPath([
        { x: 0, y: 0 },
        { x: 10, y: 20 },
        { x: 30, y: 40 },
      ]),
    ).toBe("M 0 0 Q 10 20 20 30 L 30 40");
  });

  it("scales stroke width and mosaic block size by image resolution", () => {
    expect(strokeWidthFor(1920, 1080)).toBe(4);
    expect(strokeWidthFor(3840, 2160)).toBe(8);
    expect(pixelateBlockSize(1920, 1080)).toBe(12);
    expect(pixelateBlockSize(3840, 2160)).toBe(24);
  });

  it("stops arrow shaft inside the head and clamps short arrows", () => {
    expect(arrowGeometry(10, 10, 10, 10, 4)).toBeNull();

    const normal = arrowGeometry(0, 0, 100, 0, 4);
    expect(normal).not.toBeNull();
    expect(normal!.shaftEnd.x).toBeGreaterThan(0);
    expect(normal!.shaftEnd.x).toBeLessThan(100);
    expect(normal!.shaftEnd.y).toBeCloseTo(0);
    expect(normal!.head[0]).toEqual({ x: 100, y: 0 });

    const shortArrow = arrowGeometry(0, 0, 10, 0, 4);
    expect(shortArrow).not.toBeNull();
    expect(shortArrow!.shaftEnd.x).toBeGreaterThanOrEqual(0);
    expect(shortArrow!.shaftEnd.x).toBeLessThan(10);
  });
});
