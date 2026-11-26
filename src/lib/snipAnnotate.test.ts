import { describe, expect, it } from "vitest";

import { penSvgPath, pixelateBlockSize, strokeWidthFor } from "./snipAnnotate";

describe("snipAnnotate", () => {
  it("builds smooth quadratic SVG path for freehand pen strokes", () => {
    expect(penSvgPath([])).toBe("");
    expect(penSvgPath([{ x: 10, y: 20 }])).toBe("M 10 20 L 10.01 20");
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
});
