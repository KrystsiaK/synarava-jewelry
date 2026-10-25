import "server-only";

import { createHash } from "node:crypto";

import { db } from "@/lib/db";
import { getPublishedStorefrontLocales } from "@/lib/i18n/storefront-locale-cache";
import type { StorefrontLocaleRecord } from "@/lib/i18n/storefront-locale-registry";

import type { CatalogConflictDirection, CatalogConflictField } from "./catalog-conflict";
import {
  ADOPT_SHOPIFY_FIELD_KEY,
  ADOPT_SHOPIFY_FIELD_LABEL,
  ADOPT_SHOPIFY_FIELD_PATH,
  isScopedCollectionCommerceFieldLabel,
} from "./catalog-conflict-policy";
import type { CatalogPresenceDifference } from "./catalog-presence";
import {
  buildCollectionWindowFromColumns,
  diffCollectionCommerceWindows,
} from "./collection-commerce-projection";
import type { CollectionPresenceDifference } from "./collection-presence";
import { getLatestCollectionPresenceDifferences } from "./collection-presence-server";
import { getLatestReconcileDifferences, type ReconcileDifferenceView } from "./reconciliation-run";
import { resolveCollectionWorkingSnapshot } from "./resolve-working-snapshot";

export type CollectionCatalogConflict = {
  collectionId: string;
  fields: CatalogConflictField[];
};

/** Commerce EN labels that duplicate translation reconcile fields for locale "en". */
const COMMERCE_TRANSLATION_FIELD_KEY: Record<string, string> = {
  Name: "title",
  Handle: "localizedHandle",
  Description: "description",
  "SEO title": "seoTitle",
  "SEO description": "seoDescription",
};

function resolveLocale(differenceLocale: string, locales: StorefrontLocaleRecord[]): StorefrontLocaleRecord | undefined {
  return locales.find((locale) => (locale.isDefault ? locale.code : locale.shopifyLocale) === differenceLocale);
}

function stringifyReconcileValue(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function commerceFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function slugFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
    allowedDirections: shopifyOnly
      ? ["SHOPIFY_TO_SYNARAVA"]
      : ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    presenceDifference: asCatalogPresence(difference),
  };
}

function commerceField(difference: { field: string; local: string; shopify: string; path?: string }): CatalogConflictField {
  const supported = isScopedCollectionCommerceFieldLabel(difference.field);
  const keySource = difference.path?.trim() || difference.field;
  return {
    fieldKey: `commerce:${slugFieldKey(keySource)}`,
    label: difference.field,
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: "NATIVE",
    synaravaValue: difference.local,
    shopifyValue: difference.shopify,
    baseValue: null,
    localFingerprint: commerceFingerprint(difference.local),
    shopifyFingerprint: commerceFingerprint(difference.shopify),
    allowedDirections: supported ? ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] : [],
    blockedReason: supported ? null : "No safe field-by-field write yet for this collection field.",
    sourceId: null,
    path: difference.path ?? null,
  };
}

function adoptShopifyField(shopifySummary: string): CatalogConflictField {
  const synaravaValue = "— No Synarava commerce window —";
  return {
    fieldKey: ADOPT_SHOPIFY_FIELD_KEY,
    label: ADOPT_SHOPIFY_FIELD_LABEL,
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: "NATIVE",
    synaravaValue,
    shopifyValue: shopifySummary,
    baseValue: null,
    localFingerprint: commerceFingerprint(synaravaValue),
    shopifyFingerprint: commerceFingerprint(shopifySummary),
    allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    blockedReason: null,
    sourceId: null,
    path: ADOPT_SHOPIFY_FIELD_PATH,
  };
}

/**
 * Collection conflict read model — commerce window diffs + translation reconcile
 * + one-sided catalog presence. Commerce reads existing windows only (no Synarava write).
 */
export async function getCollectionCatalogConflict(collectionId: string): Promise<CollectionCatalogConflict> {
  const presenceDifferences = await getLatestCollectionPresenceDifferences();
  const presence = presenceDifferences.find((difference) => difference.id === collectionId);
  if (presence) return { collectionId, fields: [presenceField(presence)] };

  if (collectionId.startsWith("shopify-collection:")) {
    return { collectionId, fields: [] };
  }

  const local = await db.collection.findUnique({
    where: { id: collectionId },
    select: {
      id: true,
      shopifyCollectionId: true,
      workingSnapshot: true,
      shopifySnapshot: true,
      name: true,
      slug: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
    },
  });
  if (!local) {
    return { collectionId, fields: [] };
  }

  const [differences, locales] = await Promise.all([
    getLatestReconcileDifferences(),
    getPublishedStorefrontLocales(),
  ]);

  const productDifferences = differences.filter((difference) =>
    difference.rootEntityType === "COLLECTION" && difference.rootEntityId === collectionId,
  );
  // Keep unresolved translation kinds (LOCAL_ONLY / SHOPIFY_ONLY / CONFLICT) for collections.
  const enConflictFieldKeys = new Set(
    productDifferences
      .filter((difference) => difference.locale === "en" && difference.kind === "CONFLICT")
      .map((difference) => difference.fieldKey),
  );

  const fields: CatalogConflictField[] = [];

  if (local.shopifyCollectionId) {
    const working = resolveCollectionWorkingSnapshot(local);
    const shopify = local.shopifySnapshot
      ?? buildCollectionWindowFromColumns({
        shopifyCollectionId: local.shopifyCollectionId,
        name: local.name,
        slug: local.slug,
        description: local.description,
        seoTitle: local.seoTitle,
        seoDescription: local.seoDescription,
      });
    if (working == null) {
      // Truly no Synarava commerce counterpart (no columns either).
      const record = shopify && typeof shopify === "object" && !Array.isArray(shopify)
        ? shopify as Record<string, unknown>
        : {};
      const summary = [String(record.title ?? local.name), record.handle ? `/${String(record.handle)}` : `/${local.slug}`]
        .filter(Boolean)
        .join(" · ");
      fields.push(adoptShopifyField(summary || "—"));
    } else {
      for (const difference of diffCollectionCommerceWindows(working, shopify)) {
        const translationFieldKey = COMMERCE_TRANSLATION_FIELD_KEY[difference.field];
        if (translationFieldKey && enConflictFieldKeys.has(translationFieldKey)) continue;
        fields.push(commerceField(difference));
      }
    }
  }

  for (const difference of productDifferences) {
    fields.push(translationField(difference, locales));
  }

  return { collectionId, fields };
}

/** Collection IDs with translation, presence, or commerce-window conflicts. */
export async function listConflictedCollectionIds(): Promise<string[]> {
  const [differences, presenceDifferences, commerceConflicted] = await Promise.all([
    getLatestReconcileDifferences(),
    getLatestCollectionPresenceDifferences(),
    db.collection.findMany({ where: { syncStatus: "CONFLICT" }, select: { id: true } }),
  ]);
  const collectionIds = new Set<string>();
  for (const difference of differences) {
    if (difference.rootEntityType === "COLLECTION") {
      collectionIds.add(difference.rootEntityId);
    }
  }
  for (const difference of presenceDifferences) collectionIds.add(difference.id);
  for (const row of commerceConflicted) collectionIds.add(row.id);
  return [...collectionIds];
}
