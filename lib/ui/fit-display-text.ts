/** Floor so display titles stay readable after fit shrink. */
export const DISPLAY_FIT_MIN_PX = 24; // 1.5rem at 16px root

export type FitDisplayScaleInput = {
  availableWidth: number;
  maxWordWidth: number;
  /** Lower bound for the scale factor (typically minPx / basePx). */
  minScale: number;
};

/**
 * Never break a display word. If the longest token does not fit the measure,
 * shrink type until it does (clamped to minScale), then wrap only at spaces.
 */
export function fitDisplayScale({
  availableWidth,
  maxWordWidth,
  minScale,
}: FitDisplayScaleInput): number {
  if (
    !(availableWidth > 0) ||
    !(maxWordWidth > 0) ||
    !Number.isFinite(availableWidth) ||
    !Number.isFinite(maxWordWidth)
  ) {
    return 1;
  }

  const floor = Number.isFinite(minScale) && minScale > 0 ? Math.min(minScale, 1) : 0;
  const ratio = availableWidth / maxWordWidth;
  if (ratio >= 1) return 1;
  return Math.max(floor, ratio);
}

export function displayFitMinScale(basePx: number, minPx = DISPLAY_FIT_MIN_PX): number {
  if (!(basePx > 0) || !Number.isFinite(basePx)) return 1;
  return Math.min(1, minPx / basePx);
}
