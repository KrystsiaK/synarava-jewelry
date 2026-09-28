/**
 * Scroll-spy for the legal contents nav.
 *
 * A 1px IntersectionObserver band sits on the same line as each section's
 * `scroll-mt-28` (7rem). The active item is the last section in document
 * order whose top has reached that line — the heading the reader has arrived
 * at — without a scroll listener.
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API#rootmargin
 * https://www.w3.org/TR/intersection-observer/#dom-intersectionobserverinit-rootmargin
 */

/** Matches Tailwind `top-28` / `scroll-mt-28` when computed style is unavailable. */
export const LEGAL_STICKY_OFFSET_REM = 7;

export function legalReadingLinePx(rootFontSizePx: number, scrollMarginTopPx: number | null): number {
  if (scrollMarginTopPx != null && Number.isFinite(scrollMarginTopPx) && scrollMarginTopPx > 0) {
    return scrollMarginTopPx;
  }
  const root = Number.isFinite(rootFontSizePx) && rootFontSizePx > 0 ? rootFontSizePx : 16;
  return LEGAL_STICKY_OFFSET_REM * root;
}

/** Shrinks the viewport to a 1px band at `readingLinePx`. */
export function legalSpyRootMargin(readingLinePx: number, viewportHeightPx: number): string {
  const height = viewportHeightPx > 0 ? viewportHeightPx : readingLinePx + 1;
  const line = Math.min(Math.max(readingLinePx, 0), Math.max(height - 1, 0));
  const bottom = Math.max(height - line - 1, 0);
  return `-${Math.round(line)}px 0px -${Math.round(bottom)}px 0px`;
}

type ReadingLineEntry = {
  isIntersecting: boolean;
  boundingClientRect: { top: number };
  rootBounds: { bottom: number } | null;
};

/**
 * True once the section top has reached the reading line.
 * `isIntersecting` covers the section currently crossing the 1px band.
 * A non-intersecting target whose top is already above the band has been
 * scrolled past (the initial observation does not mark it intersecting).
 */
export function sectionPassedReadingLine(entry: ReadingLineEntry, fallbackLinePx: number): boolean {
  if (entry.isIntersecting) return true;
  const line = entry.rootBounds?.bottom ?? fallbackLinePx;
  return entry.boundingClientRect.top <= line;
}

/** Last section in document order that has passed the reading line. */
export function activeLegalSectionId(order: readonly string[], passed: ReadonlySet<string>): string | null {
  let active: string | null = null;
  for (const id of order) {
    if (passed.has(id)) active = id;
  }
  return active;
}
