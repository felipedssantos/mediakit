import { describe, expect, it, vi } from "vitest";

import { animateIndicatorTo, animateStaggerIn, prefersReducedMotion } from "./motion";

describe("motion helpers", () => {
  it("handles empty targets safely without throwing", () => {
    const cleanup = animateStaggerIn(null);
    expect(typeof cleanup).toBe("function");
    cleanup();
  });

  it("positions indicator immediately when reduced motion is preferred", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockReturnValue({
        matches: true,
      } as MediaQueryList),
    );

    expect(prefersReducedMotion()).toBe(true);
    const el = document.createElement("div");
    animateIndicatorTo(el, 48, 36);
    expect(el.style.transform).toBe("translateY(48px)");
    expect(el.style.height).toBe("36px");
    expect(el.style.opacity).toBe("1");

    vi.unstubAllGlobals();
  });
});
