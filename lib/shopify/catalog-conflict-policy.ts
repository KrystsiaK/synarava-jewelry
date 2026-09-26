export const SCOPED_COMMERCE_FIELD_LABELS = new Set([
  "Vendor",
  "Product type",
  "Variant SKU",
  "Price",
  "Compare-at price",
  "Charge tax",
]);

export const COMMERCE_UNSUPPORTED_REASON =
  "No safe field-by-field write yet (e.g. Status mixes Shopify status with Synarava UNLISTED/publication). Resolve via the product editor Push/Pull for the whole commerce record.";

export function persistPayloadForCommerceInspection(inspection: {
  state: string;
  differences: unknown[];
  remoteUpdatedAt: string | null;
}) {
  if (inspection.state === "UNLINKED" || inspection.state === "REMOTE_MISSING") return null;
  if (inspection.state === "CONFLICT" && inspection.differences.length > 0) {
    return { syncStatus: "CONFLICT" as const };
  }
  if (inspection.differences.length === 0) {
    return {
      syncStatus: "SYNCED" as const,
      syncError: null,
      ...(inspection.remoteUpdatedAt ? { shopifyUpdatedAt: new Date(inspection.remoteUpdatedAt) } : {}),
    };
  }
  return null;
}
