import { describe, expect, it } from "vitest";

import { parseYoutubeUrls } from "./youtube";

describe("parseYoutubeUrls", () => {
  it("splits lines, trims whitespace, and drops empty lines", () => {
    const raw = "  https://youtu.be/abc  \n\n  https://youtube.com/watch?v=123 \r\n  ";
    expect(parseYoutubeUrls(raw)).toEqual([
      "https://youtu.be/abc",
      "https://youtube.com/watch?v=123",
    ]);
  });

  it("deduplicates repeated URLs preserving order", () => {
    const raw = [
      "https://youtu.be/first",
      "https://youtu.be/second",
      "https://youtu.be/first",
    ].join("\n");
    expect(parseYoutubeUrls(raw)).toEqual([
      "https://youtu.be/first",
      "https://youtu.be/second",
    ]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseYoutubeUrls("   \r\n\t  ")).toEqual([]);
  });
});
