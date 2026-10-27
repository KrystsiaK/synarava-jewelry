/** Shared compare-shape for snapshotForShopifyProduct ↔ deriveProductWindow. */
const W = { GRAMS: 1, KILOGRAMS: 1000, OUNCES: 28.349523125, POUNDS: 453.59237 } as const;
export type MirrorWeightUnit = keyof typeof W;

export function weightInGrams(w: { value: number; unit: MirrorWeightUnit } | null | undefined) {
  if (!w || w.value <= 0) return null;
  const m = W[w.unit];
  return m == null ? null : Math.round(w.value * m * 1e4) / 1e4;
}

/** Explicit inventoryItem fields; weight→GRAMS; omit 0/null; never inventoryLevels. */
export function mirrorInventoryItem(item: {
  id?: string | null; requiresShipping?: boolean | null; tracked?: boolean | null;
  countryCodeOfOrigin?: string | null; harmonizedSystemCode?: string | null;
  unitCost?: { amount: string; currencyCode: string } | null;
  measurement?: { weight?: { value: number; unit: MirrorWeightUnit } | null } | null;
} | null | undefined): Record<string, unknown> | null {
  if (!item) return null;
  const out: Record<string, unknown> = {
    id: item.id ?? null, requiresShipping: item.requiresShipping ?? true, tracked: item.tracked ?? true,
  };
  if ("countryCodeOfOrigin" in item) out.countryCodeOfOrigin = item.countryCodeOfOrigin ?? null;
  if ("harmonizedSystemCode" in item) out.harmonizedSystemCode = item.harmonizedSystemCode ?? null;
  if (item.unitCost != null) out.unitCost = item.unitCost;
  const g = weightInGrams(item.measurement?.weight ?? null);
  if (g != null) out.measurement = { weight: { value: g, unit: "GRAMS" } };
  return out;
}

/** Product membership = GID only; omit frontpage / storefront-default. */
export function mirrorProductCollections(
  nodes: Array<{ id?: string | null; handle?: string | null; isStorefrontDefault?: boolean }>,
) {
  return nodes.flatMap((n) => {
    const id = typeof n.id === "string" ? n.id : "";
    if (!id || n.isStorefrontDefault || n.handle === "frontpage") return [];
    return [{ id }];
  });
}
