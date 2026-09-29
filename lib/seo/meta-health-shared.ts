export type MetaHealthTone = "ok" | "partial" | "warn" | "empty";

export type SeoCoverageCounts = {
  published: number;
  missingSeoTitle: number;
};

/** Tone for published-entity SEO title coverage (not a Yoast score). */
export function seoCoverageTone(bucket: SeoCoverageCounts): MetaHealthTone {
  if (bucket.published === 0) return "empty";
  if (bucket.missingSeoTitle === 0) return "ok";
  if (bucket.missingSeoTitle === bucket.published) return "warn";
  return "partial";
}

export function richResultsTestUrl(pageUrl: string) {
  return `https://search.google.com/test/rich-results?url=${encodeURIComponent(pageUrl)}`;
}
