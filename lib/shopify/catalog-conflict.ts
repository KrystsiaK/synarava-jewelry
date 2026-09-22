import "server-only";

import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import { getLatestReconcileDifferences, type ReconcileDifferenceView } from "./reconciliation-run";
import { inspectProductSyncState, type ProductSyncDifference } from "./product-sync";

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

  if (inspection.state === "CONFLICT") {
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
  const [commerceConflicted, differences] = await Promise.all([
    db.product.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
    getLatestReconcileDifferences(),
  ]);

  const productIds = new Set(commerceConflicted.map((product) => product.id));
  for (const difference of differences) {
    if (difference.rootEntityType === "PRODUCT" && difference.kind === "CONFLICT") productIds.add(difference.rootEntityId);
  }

  return [...productIds];
}
