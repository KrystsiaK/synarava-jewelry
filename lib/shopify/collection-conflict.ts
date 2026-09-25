import "server-only";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import type { CatalogConflictDirection, CatalogConflictField } from "./catalog-conflict";
import { getLatestReconcileDifferences, type ReconcileDifferenceView } from "./reconciliation-run";

export type CollectionCatalogConflict = {
  collectionId: string;
  fields: CatalogConflictField[];
};

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
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] satisfies CatalogConflictDirection[],
    blockedReason: null,
    sourceId: difference.id,
  };
}

/**
 * Collection conflict read model — translation/reconcile divergences only.
 * Collections have no Product-style commerce syncStatus or catalog-presence
 * snapshot yet; editorial/Shopify copy drift is the conflict surface that
 * already feeds the sidebar badge via rootEntityType COLLECTION.
 */
export async function getCollectionCatalogConflict(collectionId: string): Promise<CollectionCatalogConflict> {
  const [differences, locales] = await Promise.all([
    getLatestReconcileDifferences(),
    getPublishedStorefrontLocales(),
  ]);

  const fields = differences
    .filter((difference) =>
      difference.rootEntityType === "COLLECTION"
      && difference.rootEntityId === collectionId
      && difference.kind === "CONFLICT",
    )
    .map((difference) => translationField(difference, locales));

  return { collectionId, fields };
}

/** Collection IDs with at least one unresolved translation CONFLICT (no live Shopify fetch). */
export async function listConflictedCollectionIds(): Promise<string[]> {
  const differences = await getLatestReconcileDifferences();
  const collectionIds = new Set<string>();
  for (const difference of differences) {
    if (difference.rootEntityType === "COLLECTION" && difference.kind === "CONFLICT") {
      collectionIds.add(difference.rootEntityId);
    }
  }
  return [...collectionIds];
}
