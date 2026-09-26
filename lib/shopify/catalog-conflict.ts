import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import { getLatestReconcileDifferences, type ReconcileDifferenceView } from "./reconciliation-run";
import { inspectProductSyncState, type ProductSyncDifference } from "./product-sync";
import { COMMERCE_UNSUPPORTED_REASON, SCOPED_COMMERCE_FIELD_LABELS } from "./catalog-conflict-policy";
import type { CatalogPresenceDifference } from "./catalog-presence";
import { getLatestCatalogPresenceDifferences } from "./catalog-presence-server";

// Commerce inspection compares Name/Handle/Description/SEO title/SEO
// description as flat product attributes read straight off the local
// Product row (see productSourceCopy in reconciliation-source.ts — the
// same Product columns feed translation reconcile's "en" locale). So a
// commerce difference for one of these labels and a translation-reconcile
// CONFLICT for the matching field key under locale "en" are two views of
// the exact same drift. Only drop the commerce version when reconcile has
// actually reported that exact field as conflicting for this product —
// never merely because a translation binding exists — otherwise a product
// whose binding exists but hasn't been (re)checked yet would lose the
// conflict entirely (see catalog-conflict-resolution-plan.md open note).
const COMMERCE_TRANSLATION_FIELD_KEY: Record<string, string> = {
  Name: "title",
  Handle: "localizedHandle",
  Description: "description",
  "SEO title": "seoTitle",
  "SEO description": "seoDescription",
};

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

function slugFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function commerceTargetKind(label: string): "NATIVE" | "METAFIELD" {
  return label.startsWith("Characteristic:") || label.startsWith("Certificate:") ? "METAFIELD" : "NATIVE";
}

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

function commerceField(difference: ProductSyncDifference): CatalogConflictField {
  const supported = SCOPED_COMMERCE_FIELD_LABELS.has(difference.field);
  // Prefer path in the key so two "Media gallery (image N)" rows stay distinct.
  const keySource = difference.path?.trim() || difference.field;
  return {
    fieldKey: `commerce:${slugFieldKey(keySource)}`,
    label: difference.field,
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: commerceTargetKind(difference.field),
    synaravaValue: difference.local,
    shopifyValue: difference.shopify,
    baseValue: null,
    localFingerprint: commerceFingerprint(difference.local),
    shopifyFingerprint: commerceFingerprint(difference.shopify),
    allowedDirections: supported ? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] : [],
    blockedReason: supported ? null : COMMERCE_UNSUPPORTED_REASON,
    sourceId: null,
    path: difference.path ?? null,
  };
}

function resolveLocale(differenceLocale: string, locales: StorefrontLocaleRecord[]): StorefrontLocaleRecord | undefined {
  return locales.find((locale) => (locale.isDefault ? locale.code : locale.shopifyLocale) === differenceLocale);
}

function stringifyReconcileValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function translationField(difference: ReconcileDifferenceView, locales: StorefrontLocaleRecord[]): CatalogConflictField {
  const locale = resolveLocale(difference.locale, locales);
  return {
    fieldKey: `translation:${difference.locale}:${difference.fieldKey}`,
    label: difference.fieldLabel,
    scope: {
      kind: "LOCALE",
      code: locale?.code ?? difference.locale,
      name: locale?.name ?? difference.locale,
      nativeName: locale?.nativeName ?? difference.locale,
    },
    origin: "TRANSLATION",
    targetKind: difference.targetKind,
    synaravaValue: stringifyReconcileValue(difference.localValue),
    shopifyValue: stringifyReconcileValue(difference.shopifyValue),
    baseValue: difference.baseValue == null ? null : stringifyReconcileValue(difference.baseValue),
    localFingerprint: difference.localFingerprint,
    shopifyFingerprint: difference.shopifyFingerprint,
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: difference.id,
  };
}

function presenceField(difference: CatalogPresenceDifference): CatalogConflictField {
  const shopifyOnly = difference.kind === "SHOPIFY_ONLY";
  const label = shopifyOnly
    ? difference.localProductId
      ? "Shopify product is not linked"
      : "Product exists only in Shopify"
    : difference.remoteMissing
      ? "Product is missing in Shopify"
      : "Product exists only in Synarava";
  const summarize = (identity: { name: string; sku: string } | null) => identity
    ? [identity.name, identity.sku ? `SKU ${identity.sku}` : ""].filter(Boolean).join(" · ")
    : "— Product is missing —";
  return {
    fieldKey: "presence:product",
    label,
    scope: { kind: "SHARED" },
    origin: "PRESENCE",
    targetKind: "NATIVE",
    synaravaValue: summarize(difference.localIdentity),
    shopifyValue: summarize(difference.shopifyIdentity),
    baseValue: null,
    localFingerprint: difference.localFingerprint,
    shopifyFingerprint: difference.shopifyFingerprint,
    allowedDirections: shopifyOnly ? ["SHOPIFY_TO_SYNARAVA"] : ["SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    presenceDifference: difference,
  };
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

function isVirtualPresenceProductId(productId: string): boolean {
  return productId.startsWith("shopify:");
}

/**
 * Unified per-product conflict read model: links commerce inspection
 * (live Shopify fetch) with the latest translation-reconcile state by
 * product ID, so a single card can show every conflicting field/locale
 * without the caller knowing about two separate subsystems.
 *
 * Only fields with an actual two-sided conflict are included — a
 * one-directional change (local-only edit, or an untouched remote update)
 * has its own existing push/pull flow and is deliberately left out here.
 *
 * `getLatestReconcileDifferences()` always returns the current, per-field
 * state of everything ever checked (see its doc comment) — it is not
 * gated on the most recent reconcile run's own status/scope, so a narrow
 * or failed run elsewhere never hides this product's already-known
 * translation conflicts.
 */
export async function getProductCatalogConflict(productId: string): Promise<ProductCatalogConflict> {
  const presenceDifferences = await getLatestCatalogPresenceDifferences();
  const presence = findCatalogPresenceDifference(presenceDifferences, productId);
  if (presence) return { productId, fields: [presenceField(presence)] };

  // Virtual Shopify-only ids are not Product rows. After re-scan the presence
  // row may have disappeared (already linked) — return empty fields (STALE on
  // apply) instead of calling inspectProductSyncState → findUniqueOrThrow.
  if (isVirtualPresenceProductId(productId)) {
    return { productId, fields: [] };
  }

  const local = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!local) {
    return { productId, fields: [] };
  }

  const [inspection, differences, locales] = await Promise.all([
    inspectProductSyncState(productId),
    getLatestReconcileDifferences(),
    getPublishedStorefrontLocales(),
  ]);

  const productDifferences = differences.filter((difference) =>
    difference.rootEntityType === "PRODUCT" && difference.rootEntityId === productId && difference.kind === "CONFLICT",
  );
  const enConflictFieldKeys = new Set(
    productDifferences.filter((difference) => difference.locale === "en").map((difference) => difference.fieldKey),
  );

  const fields: CatalogConflictField[] = [];

  if (inspection.state === "CONFLICT" || inspection.state === "LOCAL_CHANGES" || inspection.state === "REMOTE_CHANGES") {
    for (const difference of inspection.differences) {
      const translationFieldKey = COMMERCE_TRANSLATION_FIELD_KEY[difference.field];
      if (translationFieldKey && enConflictFieldKeys.has(translationFieldKey)) continue;
      fields.push(commerceField(difference));
    }
  }

  for (const difference of productDifferences) {
    fields.push(translationField(difference, locales));
  }

  return { productId, fields };
}

/**
 * Product IDs with at least one unresolved conflict field, for the
 * catalog-wide signal/counter. Deliberately avoids a live Shopify fetch per
 * product: the commerce side reads the `syncStatus` flag webhooks already
 * persist (set to CONFLICT when a remote update lands on unsynced local
 * changes — see product-sync.ts), and the translation side reads
 * `getLatestReconcileDifferences()`, which is always current regardless of
 * whether the most recent reconcile run was a full sweep or scoped to one
 * product/locale. Neither call is a live Shopify round trip.
 *
 * The catalog page's own "checking…"/"failed, retry" banner is a separate
 * concern — read `getLatestReconcileRun()` directly for that; it is not
 * threaded through here because it must never gate which conflicts show.
 */
export async function listConflictedProductIds(): Promise<string[]> {
  const [commerceConflicted, differences, presenceDifferences] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileDifferences(),
    getLatestCatalogPresenceDifferences(),
  ]);

  const productIds = new Set(commerceConflicted.map((product) => product.id));
  for (const difference of differences) {
    if (difference.rootEntityType === "PRODUCT" && difference.kind === "CONFLICT") productIds.add(difference.rootEntityId);
  }
  for (const difference of presenceDifferences) productIds.add(difference.id);

  return [...productIds];
}
