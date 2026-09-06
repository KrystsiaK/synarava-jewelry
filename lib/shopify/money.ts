/** Converts a Shopify decimal-string money amount (e.g. "24.50") to integer cents. */
export function shopifyAmountToCents(value: string | null | undefined): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}
