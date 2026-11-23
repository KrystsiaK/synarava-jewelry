const DEFAULT_MAX_FETCHES = 20;
const DEFAULT_MAX_REVISIT = 10;

/**
 * Split the per-domain fetch budget:
 * - up to maxRevisit previously observed active URLs (random sample)
 * - remaining slots for sitemap URLs never observed before
 */
export function selectUrlsToFetch(input: {
  priorActiveUrls: readonly string[];
  newSitemapUrls: readonly string[];
  maxFetches?: number;
  maxRevisit?: number;
  /** Injected RNG in [0, 1) for deterministic tests. */
  random?: () => number;
}): string[] {
  const maxFetches = input.maxFetches ?? DEFAULT_MAX_FETCHES;
  const maxRevisit = Math.min(input.maxRevisit ?? DEFAULT_MAX_REVISIT, maxFetches);
  const random = input.random ?? Math.random;

  const revisitPool = [...new Set(input.priorActiveUrls)];
  const newPool = [...new Set(input.newSitemapUrls)].filter(
    (u) => !revisitPool.includes(u),
  );

  const revisitCount = Math.min(maxRevisit, revisitPool.length);
  const revisited = sampleRandom(revisitPool, revisitCount, random);

  const remaining = maxFetches - revisited.length;
  const discovery = newPool.slice(0, Math.max(0, remaining));

  return [...revisited, ...discovery];
}

function sampleRandom<T>(items: T[], count: number, random: () => number): T[] {
  if (count <= 0) return [];
  if (count >= items.length) return [...items];
  const copy = [...items];
  // Fisher–Yates partial shuffle
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const tmp = copy[i]!;
    copy[i] = copy[j]!;
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}
