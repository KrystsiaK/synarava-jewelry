import type { FreeShippingMoney } from "@/lib/content/announcement-bar-fields";
import { ANNOUNCEMENT_BAR_COPY_KEY } from "@/lib/content/announcement-bar-fields";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

export { ANNOUNCEMENT_BAR_COPY_KEY };

export type AnnouncementBarViewModel = {
  text: string;
};

/**
 * Resolve storefront banner copy. Returns null when the bar must not render
 * (off, missing threshold, or empty template after amount substitution).
 */
export function resolveAnnouncementBarText(input: {
  enabled: boolean;
  threshold: FreeShippingMoney | null;
  template: string | null | undefined;
  locale: string;
}): string | null {
  if (!input.enabled) return null;
  if (!input.threshold) return null;
  const template = input.template?.trim() ?? "";
  if (!template) return null;
  const amount = formatShopifyMoneyByLocale(
    input.threshold.amount,
    input.threshold.currencyCode,
    input.locale,
  );
  if (!amount) return null;
  const text = template.replaceAll("{amount}", amount).trim();
  return text.length > 0 ? text : null;
}

/**
 * Copies per marquee half so one half covers ≥1 viewport at a conservative
 * short-string width (~220px) up to 1440px. Two halves → ≥2 viewport widths;
 * −50% translate stays seamless when spacing is padding (not gap).
 */
export const ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF = 8;

/** Target travel speed for the seamless −50% marquee cycle. */
export const ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S = 45;
export const ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S = 40;
export const ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S = 50;

/**
 * Duration (seconds) for one −50% cycle at constant px/s.
 * Distance traveled = half the cycle width (two identical halves).
 */
export function announcementMarqueeDurationSec(
  cycleWidthPx: number,
  speedPxPerS: number = ANNOUNCEMENT_MARQUEE_SPEED_PX_PER_S,
): number {
  if (!Number.isFinite(cycleWidthPx) || cycleWidthPx <= 0) return 0;
  if (!Number.isFinite(speedPxPerS) || speedPxPerS <= 0) return 0;
  return cycleWidthPx / 2 / speedPxPerS;
}

export function announcementMarqueeCopies(text: string): string[] {
  return Array.from({ length: ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF }, () => text);
}
