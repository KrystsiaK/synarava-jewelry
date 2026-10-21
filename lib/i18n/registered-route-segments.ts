/** Bootstrap route segments shipped with the app (en / pt / ru). */
const BOOTSTRAP_SEGMENTS = ["en", "pt", "ru"] as const;

/**
 * Sync snapshot of registry `routeSegment` values for path helpers that cannot
 * await the DB (client stripLocalePrefix, revalidateStorefrontPath).
 * Always includes bootstrap codes; refreshed whenever the locale cache loads or
 * the TranslationProvider mounts with registry-backed available locales.
 */
let registeredRouteSegments = new Set<string>(BOOTSTRAP_SEGMENTS);

export function getRegisteredRouteSegments(): string[] {
  return [...registeredRouteSegments];
}

export function isRegisteredRouteSegment(segment: string): boolean {
  return registeredRouteSegments.has(segment.toLowerCase());
}

/**
 * Replace the snapshot with `segments`, always retaining bootstrap en/pt/ru so
 * path helpers never regress for shipped languages (A1 lock).
 */
export function setRegisteredRouteSegments(segments: readonly string[]) {
  const next = new Set<string>(BOOTSTRAP_SEGMENTS);
  for (const segment of segments) {
    const code = segment.trim().toLowerCase();
    if (code) next.add(code);
  }
  registeredRouteSegments = next;
}

/** Test-only: restore the bootstrap set after mutating segments. */
export function resetRegisteredRouteSegmentsForTests() {
  registeredRouteSegments = new Set(BOOTSTRAP_SEGMENTS);
}
