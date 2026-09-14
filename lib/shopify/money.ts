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
