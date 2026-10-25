import "server-only";

import { createHash } from "node:crypto";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import {
  catalogConflictFieldsForEntity,
  runSyncWaterfall,
} from "@/lib/sync";

import { isAdoptShopifyConflictField as isAdoptShopifyConflictFieldPolicy } from "./catalog-conflict-policy";
import type { CatalogPresenceDifference } from "./catalog-presence";
import { getLatestCatalogPresenceDifferences } from "./catalog-presence-server";

export type CatalogConflictDirection = "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";

export type CatalogConflictFieldScope =
  | { kind: "SHARED" }
  | { kind: "LOCALE"; code: string; name: string; nativeName: string };

export type CatalogConflictField = {
  fieldKey: string;
  label: string;
  scope: CatalogConflictFieldScope;
  origin: "COMMERCE" | "TRANSLATION" | "PRESENCE";
  targetKind: "NATIVE" | "METAFIELD" | "METAOBJECT";
  synaravaValue: string;
  shopifyValue: string;
  baseValue: string | null;
  localFingerprint: string;
  shopifyFingerprint: string;
  allowedDirections: CatalogConflictDirection[];
  blockedReason: string | null;
  /** The underlying ShopifyFieldDivergence row id for a TRANSLATION field (what applyReconcileChoice needs); null for COMMERCE, which applies as a whole-product write instead of one row per field. */
  sourceId: string | null;
  /** Shopify projection path for COMMERCE rows — used to map media/etc. to the owning editor tab. */
  path?: string | null;
  presenceDifference?: CatalogPresenceDifference;
};

export type ProductCatalogConflict = {
  productId: string;
  fields: CatalogConflictField[];
};

/**
 * Change-detection fingerprint for a commerce value — `inspectProductSyncState`'s
 * `compare()` already trims and normalizes it to a plain string ("—" for
 * empty), so no further normalization is needed before hashing. Exported so
 * `commerce-field-apply.ts` can recompute the identical hash when
 * re-validating a field immediately before writing it — using a different
 * hashing scheme there would silently break staleness detection.
 */
export function commerceFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isAdoptShopifyConflictField(field: Pick<CatalogConflictField, "fieldKey" | "path" | "label">): boolean {
  return isAdoptShopifyConflictFieldPolicy(field);
}

/**
 * Presence conflict ids are either a local Product id or a virtual
 * `shopify:<numeric>` key (see remoteConflictId). After a re-scan the id may
 * remapped (SKU/handle match → local id) while the Shopify GID stays the same —
 * still resolve that row so apply does not fall through to a local Product lookup.
 */
export function findCatalogPresenceDifference(
  differences: CatalogPresenceDifference[],
  productId: string,
): CatalogPresenceDifference | undefined {
  const exact = differences.find((difference) => difference.id === productId);
  if (exact) return exact;
  if (!productId.startsWith("shopify:")) return undefined;
  const numericId = productId.slice("shopify:".length);
  if (!numericId) return undefined;
  return differences.find((difference) => {
    if (difference.kind !== "SHOPIFY_ONLY" || !difference.shopifyProductId) return false;
    const remoteNumeric = difference.shopifyProductId.split("/").pop() ?? difference.shopifyProductId;
    return remoteNumeric === numericId;
  });
}

/**
 * ConflictResolver field list from SyncResult leaves (waterfall compare).
 * Opening the resolver must use `skipRefresh: true` — no Shopify fetch.
 * Apply/preview may refresh first, then call with skipRefresh after the
 * only allowed live inspect (see catalog-conflict-apply).
 */
export async function loadProductConflictFromSyncResult(
  productId: string,
  options: { requestedBy: string; skipRefresh?: boolean },
): Promise<ProductCatalogConflict> {
  const [{ result }, locales, presenceDifferences] = await Promise.all([
    runSyncWaterfall({
      scope: { kind: "product", productId },
      requestedBy: options.requestedBy,
      skipRefresh: options.skipRefresh ?? true,
    }),
    getPublishedStorefrontLocales(),
    getLatestCatalogPresenceDifferences(),
  ]);

  const presence = findCatalogPresenceDifference(presenceDifferences, productId);
  // When presence id remapped (shopify:N → local), leaves may key on local id.
  const resourceId = presence?.id ?? productId;
  const fields = catalogConflictFieldsForEntity(result, {
    resourceType: "PRODUCT",
    resourceId,
    locales: locales.map((locale) => ({
      code: locale.code,
      name: locale.name,
      nativeName: locale.nativeName,
    })),
    presenceDifference: presence,
  });

  // Virtual id with remapped presence: also try the caller's id if empty.
  if (fields.length === 0 && resourceId !== productId) {
    return {
      productId,
      fields: catalogConflictFieldsForEntity(result, {
        resourceType: "PRODUCT",
        resourceId: productId,
        locales: locales.map((locale) => ({
          code: locale.code,
          name: locale.name,
          nativeName: locale.nativeName,
        })),
        presenceDifference: presence,
      }),
    };
  }

  return { productId, fields };
}

/**
 * Product IDs with ≥1 open SyncResult leaf — derived from waterfall
 * skipRefresh compare, not from `syncStatus: CONFLICT` DB flags.
 */
export async function listConflictedProductIds(requestedBy = "system"): Promise<string[]> {
  const { result } = await runSyncWaterfall({
    scope: { kind: "catalog" },
    requestedBy,
    skipRefresh: true,
  });
  const productIds = new Set<string>();
  for (const leaf of result.leaves) {
    if (leaf.resourceType === "PRODUCT") productIds.add(leaf.resourceId);
  }
  return [...productIds];
}
