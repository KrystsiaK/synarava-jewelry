export const SCOPED_COMMERCE_FIELD_LABELS = new Set([
  "Name",
  "Handle",
  "Vendor",
  "Product type",
  "Variant SKU",
  "Price",
  "Compare-at price",
  "Charge tax",
]);

/** Media gallery rows — adopt whole `media` (Pull) or Push pipeline (Push). */
export function isMediaGalleryFieldLabel(label: string): boolean {
  return label === "Media gallery" || label.startsWith("Media gallery (");
}

export function isScopedCommerceFieldLabel(label: string): boolean {
  return SCOPED_COMMERCE_FIELD_LABELS.has(label) || isMediaGalleryFieldLabel(label);
}

export const COMMERCE_UNSUPPORTED_REASON =
  "No safe field-by-field write yet (e.g. Status, tags). Resolve with Pull (take Shopify) or Push (send Synarava) for the whole commerce record.";

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
