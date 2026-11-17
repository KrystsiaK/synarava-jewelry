import { formatCurrency } from "@/lib/i18n/format";

/** Converts a Shopify decimal-string money amount (e.g. "24.50") to integer cents. */
export function shopifyAmountToCents(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/** Rounded percentage off, or null when there's no real discount to show. */
export function discountPercent(priceAmount: number, compareAtAmount: number | null): number | null {
  if (compareAtAmount == null || compareAtAmount <= priceAmount) return null;
  return Math.round((1 - priceAmount / compareAtAmount) * 100);
}

/**
 * Locale-aware display for a Shopify money amount (storefront announcement bar).
 * Never hardcode a threshold into copy — format the synced amount here.
 */
export function formatShopifyMoneyByLocale(
  amount: string | number,
  currencyCode: string,
  locale: string,
): string {
  const value = typeof amount === "string" ? Number.parseFloat(amount) : amount;
  if (!Number.isFinite(value) || !currencyCode.trim()) return "";
  return formatCurrency(value, currencyCode, locale);
}
