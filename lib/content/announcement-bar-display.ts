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

