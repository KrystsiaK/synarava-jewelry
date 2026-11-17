import type { FreeShippingMoney } from "@/lib/content/announcement-bar-fields";
import { ANNOUNCEMENT_BAR_COPY_KEY } from "@/lib/content/announcement-bar-fields";
import { formatShopifyMoneyByLocale } from "@/lib/shopify/money";

export { ANNOUNCEMENT_BAR_COPY_KEY };

export type AnnouncementBarViewModel = {
  text: string;
};

/**
 * Resolve storefront banner copy. Returns null when the bar must not render
 * (off, missing Shopify snapshot amount, or empty template after substitution).
 */
export function resolveAnnouncementBarText(input: {
  enabled: boolean;
  freeShippingMinSubtotal: FreeShippingMoney | null;
  template: string | null | undefined;
  locale: string;
}): string | null {
  if (!input.enabled) return null;
  if (!input.freeShippingMinSubtotal) return null;
  const template = input.template?.trim() ?? "";
  if (!template) return null;
  const amount = formatShopifyMoneyByLocale(
    input.freeShippingMinSubtotal.amount,
    input.freeShippingMinSubtotal.currencyCode,
    input.locale,
  );
  if (!amount) return null;
  const text = template.replaceAll("{amount}", amount).trim();
  return text.length > 0 ? text : null;
}

/**
 * How many text copies go in each marquee half so one half covers ≥1 viewport
 * at a conservative short-string width (~220px) up to 1440px.
 * Two halves → ≥2 viewport widths; −50% translate stays seamless.
 */
export const ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF = 8;

export function announcementMarqueeCopies(text: string): string[] {
  return Array.from({ length: ANNOUNCEMENT_MARQUEE_COPIES_PER_HALF }, () => text);
}
