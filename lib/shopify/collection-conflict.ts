import "server-only";

import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import type { CatalogConflictDirection, CatalogConflictField } from "./catalog-conflict";
import type { CatalogPresenceDifference } from "./catalog-presence";
import type { CollectionPresenceDifference } from "./collection-presence";
import { getLatestCollectionPresenceDifferences } from "./collection-presence-server";
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

function asCatalogPresence(difference: CollectionPresenceDifference): CatalogPresenceDifference {
  return difference;
}

function presenceField(difference: CollectionPresenceDifference): CatalogConflictField {
  const shopifyOnly = difference.kind === "SHOPIFY_ONLY";
  const label = shopifyOnly
    ? difference.localProductId
      ? "Shopify collection is not linked"
      : "Collection exists only in Shopify"
    : difference.remoteMissing
      ? "Collection is missing in Shopify"
      : "Collection exists only in Synarava";
  const summarize = (identity: { name: string; handle: string } | null) => identity
    ? [identity.name, identity.handle ? `/${identity.handle}` : ""].filter(Boolean).join(" · ")
    : "— Collection is missing —";
  return {
    fieldKey: "presence:collection",
    label,
    scope: { kind: "SHARED" },
    origin: "PRESENCE",
    targetKind: "NATIVE",
    synaravaValue: summarize(difference.localIdentity),
    shopifyValue: summarize(difference.shopifyIdentity),
    baseValue: null,
    localFingerprint: difference.localFingerprint,
    shopifyFingerprint: difference.shopifyFingerprint,
    // Synarava-only: Push OR take Shopify ("missing") = delete locally.
    allowedDirections: shopifyOnly
      ? ["SHOPIFY_TO_SYNARAVA"]
      : ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    presenceDifference: asCatalogPresence(difference),
  };
}

/**
 * Collection conflict read model — translation/reconcile divergences plus
 * one-sided catalog presence (Shopify-only / Synarava-only collections).
 */
export async function getCollectionCatalogConflict(collectionId: string): Promise<CollectionCatalogConflict> {
  const presenceDifferences = await getLatestCollectionPresenceDifferences();
  const presence = presenceDifferences.find((difference) => difference.id === collectionId);
  if (presence) return { collectionId, fields: [presenceField(presence)] };

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

/** Collection IDs with translation CONFLICT and/or catalog-presence differences. */
export async function listConflictedCollectionIds(): Promise<string[]> {
  const [differences, presenceDifferences] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCollectionPresenceDifferences(),
  ]);
  const collectionIds = new Set<string>();
  for (const difference of differences) {
    if (difference.rootEntityType === "COLLECTION" && difference.kind === "CONFLICT") {
      collectionIds.add(difference.rootEntityId);
    }
  }
  for (const difference of presenceDifferences) collectionIds.add(difference.id);
  return [...collectionIds];
}
