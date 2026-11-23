/** Splits newline-separated input into unique, non-empty media URLs. */
export function parseYoutubeUrls(raw: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    urls.push(trimmed);
  }
  return urls;
}
