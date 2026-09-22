import "server-only";

import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import { getLatestReconcileDifferences, getLatestReconcileRun, type ReconcileDifferenceView } from "./reconciliation-run";
import { inspectProductSyncState, type ProductSyncDifference } from "./product-sync";

// Commerce inspection compares Name/Handle/Description/SEO title/SEO
// description as flat product attributes, but those same fields are also
// localized content covered by translation reconciliation's "en" locale
// (PRODUCT_FIELD_REGISTRY marks them `mode: "localized"`). Surfacing both
// would show the same underlying drift twice under different UI shapes, so
// the commerce side is excluded here in favor of the locale-scoped version.
const COMMERCE_LOCALE_DUPLICATE_LABELS = new Set([
  "Name",
  "Handle",
  "Description",
  "SEO title",
  "SEO description",
]);

export type CatalogConflictDirection = "SHOPIFY_TO_SYNARAVA" | "SYNARAVA_TO_SHOPIFY";

export type CatalogConflictFieldScope =
  | { kind: "SHARED" }
  | { kind: "LOCALE"; code: string; name: string; nativeName: string };

export type CatalogConflictField = {
  fieldKey: string;
  label: string;
  scope: CatalogConflictFieldScope;
  origin: "COMMERCE" | "TRANSLATION";
  targetKind: "NATIVE" | "METAFIELD" | "METAOBJECT";
  synaravaValue: string;
  shopifyValue: string;
  baseValue: string | null;
  localFingerprint: string | null;
  shopifyFingerprint: string | null;
  allowedDirections: CatalogConflictDirection[];
  blockedReason: string | null;
};

export type ProductCatalogConflict = {
  productId: string;
  fields: CatalogConflictField[];
  /** Translation-reconcile portion is only as fresh as the latest run; false when that run is missing/queued/failed. */
  translationChecked: boolean;
  translationCheckedAt: string | null;
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

function commerceField(difference: ProductSyncDifference): CatalogConflictField {
  return {
    fieldKey: `commerce:${slugFieldKey(difference.field)}`,
    label: difference.field,
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: commerceTargetKind(difference.field),
    synaravaValue: difference.local,
    shopifyValue: difference.shopify,
    baseValue: null,
    localFingerprint: null,
    shopifyFingerprint: null,
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
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
  };
}

/**
 * Unified per-product conflict read model: links commerce inspection
 * (live Shopify fetch) with the latest translation-reconcile sweep by
 * product ID, so a single card can show every conflicting field/locale
 * without the caller knowing about two separate subsystems.
 *
 * Only fields with an actual two-sided conflict are included — a
 * one-directional change (local-only edit, or an untouched remote update)
 * has its own existing push/pull flow and is deliberately left out here.
 */
export async function getProductCatalogConflict(productId: string): Promise<ProductCatalogConflict> {
  const [inspection, run, locales] = await Promise.all([
    inspectProductSyncState(productId),
    getLatestReconcileRun(),
    getPublishedStorefrontLocales(),
  ]);

  const fields: CatalogConflictField[] = [];

  if (inspection.state === "CONFLICT") {
    for (const difference of inspection.differences) {
      if (COMMERCE_LOCALE_DUPLICATE_LABELS.has(difference.field)) continue;
      fields.push(commerceField(difference));
    }
  }

  const translationChecked = run != null && (run.status === "SUCCEEDED" || run.status === "PARTIAL");
  if (translationChecked) {
    const differences = await getLatestReconcileDifferences();
    for (const difference of differences) {
      if (difference.rootEntityType !== "PRODUCT" || difference.rootEntityId !== productId) continue;
      if (difference.kind !== "CONFLICT") continue;
      fields.push(translationField(difference, locales));
    }
  }

  return {
    productId,
    fields,
    translationChecked,
    translationCheckedAt: run?.completedAt ?? null,
  };
}

/**
 * Product IDs with at least one unresolved conflict field, for the
 * catalog-wide signal/counter. Deliberately avoids a live Shopify fetch per
 * product: the commerce side reads the `syncStatus` flag webhooks already
 * persist (set to CONFLICT when a remote update lands on unsynced local
 * changes — see product-sync.ts), and the translation side reads the
 * latest reconcile sweep. Neither call is a live Shopify round trip.
 */
export async function listConflictedProductIds(): Promise<{ productIds: string[]; translationChecked: boolean }> {
  const [commerceConflicted, run] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileRun(),
  ]);

  const productIds = new Set(commerceConflicted.map((product) => product.id));

  const translationChecked = run != null && (run.status === "SUCCEEDED" || run.status === "PARTIAL");
  if (translationChecked) {
    const differences = await getLatestReconcileDifferences();
    for (const difference of differences) {
      if (difference.rootEntityType === "PRODUCT" && difference.kind === "CONFLICT") productIds.add(difference.rootEntityId);
    }
  }

  return { productIds: [...productIds], translationChecked };
}
