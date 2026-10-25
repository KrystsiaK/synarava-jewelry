/**
 * THE one compare function — product commerce, collection commerce (when
 * windows exist), translation, and presence → one SyncResult.
 *
 * Commerce uses canonicalize + diffShopifyProjections (ADR-0003).
 * Translations are two-way only (PR3). Presence is one leaf per entity.
 */

import {
  ADOPT_SHOPIFY_FIELD_KEY,
  ADOPT_SHOPIFY_FIELD_LABEL,
  ADOPT_SHOPIFY_FIELD_PATH,
  COMMERCE_UNSUPPORTED_REASON,
  isScopedCommerceFieldLabel,
} from "@/lib/shopify/catalog-conflict-policy";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";
import type { CollectionPresenceDifference } from "@/lib/shopify/collection-presence";
import {
  diffShopifyProjections,
  type ShopifyProjectionDiff,
} from "@/lib/shopify/shopify-projection-diff";
import type { ReconcileDifferenceView } from "@/lib/shopify/reconciliation-run";

import {
  emptySyncResult,
  type SyncDirection,
  type SyncLeaf,
  type SyncResourceType,
  type SyncResult,
  type SyncResultState,
} from "./types";

const STALE_AFTER_MS = 30 * 60 * 1000;

export type SyncLocaleRef = {
  code: string;
  shopifyLocale: string;
  name: string;
  nativeName: string;
  isDefault: boolean;
  sortOrder: number;
};

export type SyncCommerceWindow = {
  resourceType: "PRODUCT" | "COLLECTION";
  resourceId: string;
  workingSnapshot: unknown | null;
  shopifySnapshot: unknown | null;
};

export type SyncCompareInput = {
  commerceWindows: readonly SyncCommerceWindow[];
  translationDifferences: ReadonlyArray<
    Pick<
      ReconcileDifferenceView,
      | "id"
      | "rootEntityType"
      | "rootEntityId"
      | "locale"
      | "fieldKey"
      | "fieldLabel"
      | "kind"
      | "localValue"
      | "shopifyValue"
      | "localFingerprint"
      | "shopifyFingerprint"
      | "targetKind"
    >
  >;
  productPresence: readonly CatalogPresenceDifference[];
  collectionPresence: readonly CollectionPresenceDifference[];
  locales: readonly SyncLocaleRef[];
  connected: boolean;
  checkedAt: string | null;
  runStatus?: "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "PARTIAL" | null;
  runTrigger?: string | null;
  now?: Date;
  recentlyUpdatedProducts?: ReadonlyArray<{ productId: string; updatedAt: string }>;
};

function slugFieldKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stringify(value: unknown): string {
  if (value == null) return "";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function resolveLocaleCode(differenceLocale: string, locales: readonly SyncLocaleRef[]): string {
  const match = locales.find((locale) =>
    (locale.isDefault ? locale.code : locale.shopifyLocale) === differenceLocale,
  );
  return match?.code ?? differenceLocale;
}

function resolveState(input: SyncCompareInput, now: Date): SyncResultState {
  if (!input.connected) return "disconnected";
  if (input.runStatus === "QUEUED" || input.runStatus === "RUNNING") return "checking";
  if (input.runStatus === "FAILED" || input.runStatus === "PARTIAL") return "failed";
  if (!input.checkedAt || now.getTime() - new Date(input.checkedAt).getTime() > STALE_AFTER_MS) {
    return "stale";
  }
  return "ready";
}

function commerceLeaf(
  resourceType: "PRODUCT" | "COLLECTION",
  resourceId: string,
  diff: ShopifyProjectionDiff,
): SyncLeaf {
  const supported = isScopedCommerceFieldLabel(diff.field);
  const keySource = diff.path?.trim() || diff.field;
  return {
    id: `${resourceType}:${resourceId}:commerce:${slugFieldKey(keySource)}`,
    resourceType,
    resourceId,
    kind: "commerce",
    locale: null,
    fieldKey: `commerce:${slugFieldKey(keySource)}`,
    label: diff.field,
    synaravaValue: diff.local,
    shopifyValue: diff.shopify,
    allowedDirections: supported
      ? (["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"] satisfies SyncDirection[])
      : [],
    blockedReason: supported ? null : COMMERCE_UNSUPPORTED_REASON,
    sourceId: null,
    path: diff.path ?? null,
  };
}

function adoptLeaf(resourceType: "PRODUCT" | "COLLECTION", resourceId: string, shopifySummary: string): SyncLeaf {
  return {
    id: `${resourceType}:${resourceId}:${ADOPT_SHOPIFY_FIELD_KEY}`,
    resourceType,
    resourceId,
    kind: "commerce",
    locale: null,
    fieldKey: ADOPT_SHOPIFY_FIELD_KEY,
    label: ADOPT_SHOPIFY_FIELD_LABEL,
    synaravaValue: "— No Synarava commerce window —",
    shopifyValue: shopifySummary,
    allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    blockedReason: null,
    sourceId: null,
    path: ADOPT_SHOPIFY_FIELD_PATH,
  };
}

function compareCommerceWindows(windows: readonly SyncCommerceWindow[]): {
  leaves: SyncLeaf[];
  uncheckedCount: number;
} {
  const leaves: SyncLeaf[] = [];
  let uncheckedCount = 0;
  for (const window of windows) {
    if (window.shopifySnapshot == null && window.workingSnapshot == null) continue;
    if (window.workingSnapshot == null && window.shopifySnapshot != null) {
      leaves.push(adoptLeaf(window.resourceType, window.resourceId, "— Shopify window present —"));
      continue;
    }
    // Linked entity loaded for compare but Shopify window never fetched —
    // not a conflict, and not "all good". Count separately (audit: compare skip).
    if (window.shopifySnapshot == null) {
      uncheckedCount += 1;
      continue;
    }
    if (window.workingSnapshot == null) continue;
    const diffs = diffShopifyProjections(window.workingSnapshot, window.shopifySnapshot);
    for (const diff of diffs) {
      leaves.push(commerceLeaf(window.resourceType, window.resourceId, diff));
    }
  }
  return { leaves, uncheckedCount };
}

function asResourceType(value: string): SyncResourceType | null {
  if (value === "PRODUCT" || value === "COLLECTION" || value === "PAGE" || value === "STOREFRONT_COPY") {
    return value;
  }
  return null;
}

/**
 * Commerce window labels → translation fieldKeys they already cover.
 * Default-locale translation leaves for these keys are dropped when a commerce
 * leaf for the same resource exists (one conflict, not two). PAGE EN,
 * editorial EN (subtitle, symbolism, details, …), and STOREFRONT_COPY stay.
 */
const COMMERCE_LABEL_TO_TRANSLATION_KEYS: Record<string, readonly string[]> = {
  Name: ["name", "title"],
  Handle: ["localizedHandle"],
  Description: ["description"],
  "SEO title": ["seoTitle"],
  "SEO description": ["seoDescription"],
};

function commerceCoveredTranslationKeys(commerceLeaves: readonly SyncLeaf[]): Set<string> {
  const covered = new Set<string>();
  for (const leaf of commerceLeaves) {
    if (leaf.kind !== "commerce") continue;
    const keys = COMMERCE_LABEL_TO_TRANSLATION_KEYS[leaf.label];
    if (!keys) continue;
    for (const key of keys) {
      covered.add(`${leaf.resourceType}:${leaf.resourceId}:${key}`);
    }
  }
  return covered;
}

function translationLeaves(
  differences: SyncCompareInput["translationDifferences"],
  locales: readonly SyncLocaleRef[],
  commerceLeaves: readonly SyncLeaf[],
): SyncLeaf[] {
  const leaves: SyncLeaf[] = [];
  const seen = new Set<string>();
  const defaultLocaleCode = locales.find((locale) => locale.isDefault)?.code;
  const coveredByCommerce = commerceCoveredTranslationKeys(commerceLeaves);
  for (const difference of differences) {
    const resourceType = asResourceType(difference.rootEntityType);
    if (!resourceType) continue;
    if (
      defaultLocaleCode
      && resolveLocaleCode(difference.locale, locales) === defaultLocaleCode
      && coveredByCommerce.has(`${resourceType}:${difference.rootEntityId}:${difference.fieldKey}`)
    ) continue;
    // PR3: two-way compare emits CONFLICT for any Synarava ≠ Shopify.
    // Legacy LOCAL_ONLY / SHOPIFY_ONLY rows are ignored until re-checked.
    if (difference.kind !== "CONFLICT" && difference.rootEntityType === "PRODUCT") continue;
    const locale = resolveLocaleCode(difference.locale, locales);
    const id = `${resourceType}:${difference.rootEntityId}:translation:${difference.locale}:${difference.fieldKey}`;
    if (seen.has(id)) continue;
    seen.add(id);
    leaves.push({
      id,
      resourceType,
      resourceId: difference.rootEntityId,
      kind: "translation",
      locale,
      fieldKey: `translation:${difference.locale}:${difference.fieldKey}`,
      label: difference.fieldLabel,
      synaravaValue: stringify(difference.localValue),
      shopifyValue: stringify(difference.shopifyValue),
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
      blockedReason: null,
      sourceId: difference.id,
      path: null,
    });
  }
  return leaves;
}

function productPresenceLeaf(difference: CatalogPresenceDifference): SyncLeaf {
  const shopifyOnly = difference.kind === "SHOPIFY_ONLY";
  const label = shopifyOnly
    ? difference.localProductId
      ? "Shopify product is not linked"
      : "Product exists only in Shopify"
    : difference.remoteMissing
      ? "Product is missing in Shopify"
      : "Product exists only in Synarava";
  const identity = difference.shopifyIdentity ?? difference.localIdentity;
  return {
    id: `PRODUCT:${difference.id}:presence`,
    resourceType: "PRODUCT",
    resourceId: difference.id,
    kind: "presence",
    locale: null,
    fieldKey: "presence:product",
    label,
    synaravaValue: difference.localIdentity?.name ?? "— Product is missing —",
    shopifyValue: difference.shopifyIdentity?.name ?? "— Product is missing —",
    allowedDirections: shopifyOnly ? ["SHOPIFY_TO_SYNARAVA"] : ["SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: null,
    displayName: identity?.name ?? difference.name,
    displayHandle: identity?.handle ?? difference.handle,
    displaySku: identity?.sku ?? difference.sku,
  };
}

function collectionPresenceLeaf(difference: CollectionPresenceDifference): SyncLeaf {
  const shopifyOnly = difference.kind === "SHOPIFY_ONLY";
  const label = shopifyOnly
    ? difference.localProductId
      ? "Shopify collection is not linked"
      : "Collection exists only in Shopify"
    : difference.remoteMissing
      ? "Collection is missing in Shopify"
      : "Collection exists only in Synarava";
  const identity = difference.shopifyIdentity ?? difference.localIdentity;
  return {
    id: `COLLECTION:${difference.id}:presence`,
    resourceType: "COLLECTION",
    resourceId: difference.id,
    kind: "presence",
    locale: null,
    fieldKey: "presence:collection",
    label,
    synaravaValue: difference.localIdentity?.name ?? "— Collection is missing —",
    shopifyValue: difference.shopifyIdentity?.name ?? "— Collection is missing —",
    allowedDirections: shopifyOnly
      ? ["SHOPIFY_TO_SYNARAVA"]
      : ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: null,
    displayName: identity?.name ?? difference.name,
    displayHandle: identity?.handle ?? difference.handle,
    displaySku: identity?.sku ?? difference.sku,
  };
}

/**
 * Compare Synarava vs Shopify across every synced resource kind.
 * Pure over already-fetched windows / reconcile rows / presence snapshots.
 */
export function compareSyncState(input: SyncCompareInput): SyncResult {
  const now = input.now ?? new Date();
  const presenceResourceIds = new Set<string>();
  const leaves: SyncLeaf[] = [];

  for (const difference of input.productPresence) {
    presenceResourceIds.add(`PRODUCT:${difference.id}`);
    leaves.push(productPresenceLeaf(difference));
  }
  for (const difference of input.collectionPresence) {
    presenceResourceIds.add(`COLLECTION:${difference.id}`);
    leaves.push(collectionPresenceLeaf(difference));
  }

  // Presence replaces field-level commerce/translation for that entity
  // (same rule as getProductCatalogConflict / getCollectionCatalogConflict).
  const commerceWindows = input.commerceWindows.filter(
    (window) => !presenceResourceIds.has(`${window.resourceType}:${window.resourceId}`),
  );
  const commerce = compareCommerceWindows(commerceWindows);
  leaves.push(...commerce.leaves);

  const translation = translationLeaves(
    input.translationDifferences,
    input.locales,
    commerce.leaves,
  ).filter(
    (leaf) => !presenceResourceIds.has(`${leaf.resourceType}:${leaf.resourceId}`),
  );
  leaves.push(...translation);

  return emptySyncResult({
    checkedAt: input.checkedAt,
    state: resolveState(input, now),
    leaves,
    uncheckedCount: commerce.uncheckedCount,
    recentlyUpdatedProducts: Object.fromEntries(
      (input.recentlyUpdatedProducts ?? []).map((item) => [item.productId, { updatedAt: item.updatedAt }]),
    ),
  });
}
