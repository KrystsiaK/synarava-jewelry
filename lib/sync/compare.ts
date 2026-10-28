/**
 * THE one compare function — product commerce, collection commerce (when
 * windows exist), translation, and presence → one SyncResult.
 *
 * Commerce uses canonicalize + diffShopifyProjections (ADR-0003).
 * Translations are two-way only (PR3). Presence is one leaf per entity.
 */

import { createHash } from "node:crypto";

import {
  ADOPT_SHOPIFY_FIELD_KEY,
  ADOPT_SHOPIFY_FIELD_LABEL,
  ADOPT_SHOPIFY_FIELD_PATH,
  COMMERCE_UNSUPPORTED_REASON,
  MULTI_VARIANT_PUSH_BLOCKED_REASON,
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
  ADOPT_CONTRACT_KEY,
  PRESENCE_CONTRACT_KEY,
  UNMAPPED_CONTRACT_KEY,
  WHOLE_ITEM_CONTRACT_KEY,
  contractKeyForWindowPath,
  isUnmappedWindowPath,
  lookupContractForPath,
  lookupTranslationContractMeta,
  type SyncConflictSection,
  type SyncLeafPart,
} from "./field-registry";
import {
  emptySyncResult,
  type SyncDirection,
  type SyncLeaf,
  type SyncLeafKind,
  type SyncPresenceSide,
  type SyncResourceType,
  type SyncResult,
  type SyncResultState,
  type SyncTargetKind,
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
  /** Derived OUR Shopify-shaped window (columns + extras). */
  ourWindow: unknown | null;
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

/** Same sha256 scheme as `commerceFingerprint` in catalog-conflict (no server-only import). */
function leafFingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function commerceTargetKind(label: string): SyncTargetKind {
  return label.startsWith("Characteristic:") || label.startsWith("Certificate:") ? "METAFIELD" : "NATIVE";
}

/**
 * Single source for leaf `allowedDirections` — commerce / translation / presence.
 */
export function allowedDirectionsForLeaf(input: {
  kind: SyncLeafKind;
  resourceType: SyncResourceType;
  presenceSide?: SyncPresenceSide | null;
  /** Commerce field supported for field-by-field apply. */
  commerceSupported?: boolean;
  /** Missing Synarava commerce window (Adopt Shopify). */
  adopt?: boolean;
}): SyncDirection[] {
  if (input.kind === "presence") {
    if (input.presenceSide === "SHOPIFY_ONLY") return ["SHOPIFY_TO_SYNARAVA"];
    if (input.resourceType === "COLLECTION") {
      return ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
    }
    return ["SYNARAVA_TO_SHOPIFY"];
  }
  if (input.kind === "commerce") {
    if (input.adopt) return ["SHOPIFY_TO_SYNARAVA"];
    if (input.commerceSupported === false) return [];
    return ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
  }
  return ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"];
}

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

function partFromDiff(diff: ShopifyProjectionDiff): SyncLeafPart {
  const path = diff.path ?? "";
  const contract = path ? lookupContractForPath(path) : null;
  return {
    contractKey: contract?.contractKey ?? (path ? contractKeyForWindowPath(path) : UNMAPPED_CONTRACT_KEY),
    path,
    label: contract?.label ?? diff.field,
    section: contract?.section ?? "shopify",
    local: diff.local,
    shopify: diff.shopify,
  };
}

function commerceLeaf(
  resourceType: "PRODUCT" | "COLLECTION",
  resourceId: string,
  diff: ShopifyProjectionDiff,
): SyncLeaf {
  const path = diff.path ?? "";
  const unmapped = Boolean(path) && isUnmappedWindowPath(path);
  const contract = path ? lookupContractForPath(path) : null;
  const supported = !unmapped && isScopedCommerceFieldLabel(diff.field);
  const keySource = path.trim() || diff.field;
  const label = unmapped ? `Unmapped Shopify field ${path}` : (contract?.label ?? diff.field);
  const section: SyncConflictSection = unmapped ? "shopify" : (contract?.section ?? "shopify");
  const contractKey = unmapped ? UNMAPPED_CONTRACT_KEY : (contract?.contractKey ?? slugFieldKey(keySource));
  // Shared commerce leaves address under node 'base' only (never under locale tabs).
  return {
    id: `${resourceType}:${resourceId}:commerce:${slugFieldKey(keySource)}`,
    resourceType,
    resourceId,
    kind: "commerce",
    locale: null,
    fieldKey: unmapped ? `commerce:unmapped:${slugFieldKey(path)}` : `commerce:${slugFieldKey(keySource)}`,
    label,
    synaravaValue: diff.local,
    shopifyValue: diff.shopify,
    allowedDirections: allowedDirectionsForLeaf({
      kind: "commerce",
      resourceType,
      commerceSupported: supported && !unmapped,
    }),
    blockedReason: unmapped || !supported ? COMMERCE_UNSUPPORTED_REASON : null,
    sourceId: null,
    path: path || null,
    contractKey,
    section,
    parts: null,
    presenceSide: null,
    targetKind: commerceTargetKind(label),
    localFingerprint: leafFingerprint(diff.local),
    shopifyFingerprint: leafFingerprint(diff.shopify),
    node: "base",
  };
}

/** Stable fieldKey for the one whole-record product commerce leaf. */
export const WHOLE_ITEM_COMMERCE_FIELD_KEY = WHOLE_ITEM_CONTRACT_KEY;

/** Variant rows on a Shopify-shaped commerce window (OUR or snapshot). */
function projectionVariantCount(window: unknown): number {
  if (!window || typeof window !== "object" || Array.isArray(window)) return 0;
  const variants = (window as { variants?: unknown }).variants;
  return Array.isArray(variants) ? variants.length : 0;
}

export function isMultiVariantCommerceWindow(ourWindow: unknown, shopifySnapshot: unknown): boolean {
  return projectionVariantCount(ourWindow) > 1 || projectionVariantCount(shopifySnapshot) > 1;
}

/** Collapse ALL product commerce diffs into one whole-record leaf (when any need it). */
function wholeItemCommerceLeaf(
  resourceId: string,
  diffs: readonly ShopifyProjectionDiff[],
  options?: { multiVariant?: boolean },
): SyncLeaf {
  const sorted = [...diffs].toSorted((a, b) => a.field.localeCompare(b.field) || a.path.localeCompare(b.path));
  // Group by contractKey for field count, but keep EVERY path/value — dropping
  // later diffs under the same key made the stale-preview fingerprint miss
  // second media/variant changes.
  const parts = sorted.map(partFromDiff).toSorted(
    (a, b) => a.contractKey.localeCompare(b.contractKey)
      || a.label.localeCompare(b.label)
      || a.path.localeCompare(b.path),
  );
  const fieldCount = new Set(parts.map((part) => part.contractKey)).size;
  const synaravaValue = parts.map((part) => `${part.label}: ${part.local}`).join("\n");
  const shopifyValue = parts.map((part) => `${part.label}: ${part.shopify}`).join("\n");
  const multiVariant = options?.multiVariant === true;
  // Fingerprints hash all paths/values — not the visible summary, not first-only.
  return {
    id: `PRODUCT:${resourceId}:${WHOLE_ITEM_COMMERCE_FIELD_KEY}`,
    resourceType: "PRODUCT",
    resourceId,
    kind: "commerce",
    locale: null,
    fieldKey: WHOLE_ITEM_COMMERCE_FIELD_KEY,
    label: `Product data (${fieldCount} fields)`,
    synaravaValue,
    shopifyValue,
    // Multi-variant: Take Shopify only — Keep ours would push variants[0] alone.
    allowedDirections: multiVariant ? ["SHOPIFY_TO_SYNARAVA"] : [],
    blockedReason: multiVariant ? MULTI_VARIANT_PUSH_BLOCKED_REASON : COMMERCE_UNSUPPORTED_REASON,
    sourceId: null,
    path: null,
    contractKey: WHOLE_ITEM_CONTRACT_KEY,
    section: parts[0]?.section ?? "shopify",
    parts,
    presenceSide: null,
    targetKind: "NATIVE",
    localFingerprint: leafFingerprint(JSON.stringify(parts.map((p) => ({ path: p.path, local: p.local })))),
    shopifyFingerprint: leafFingerprint(JSON.stringify(parts.map((p) => ({ path: p.path, shopify: p.shopify })))),
    node: "base",
  };
}

function adoptLeaf(resourceType: "PRODUCT" | "COLLECTION", resourceId: string, shopifySummary: string): SyncLeaf {
  const synaravaValue = "— No Synarava commerce window —";
  return {
    id: `${resourceType}:${resourceId}:${ADOPT_SHOPIFY_FIELD_KEY}`,
    resourceType,
    resourceId,
    kind: "commerce",
    locale: null,
    fieldKey: ADOPT_SHOPIFY_FIELD_KEY,
    label: ADOPT_SHOPIFY_FIELD_LABEL,
    synaravaValue,
    shopifyValue: shopifySummary,
    allowedDirections: allowedDirectionsForLeaf({
      kind: "commerce",
      resourceType,
      adopt: true,
    }),
    blockedReason: null,
    sourceId: null,
    path: ADOPT_SHOPIFY_FIELD_PATH,
    contractKey: ADOPT_CONTRACT_KEY,
    section: "shopify",
    parts: null,
    presenceSide: null,
    targetKind: "NATIVE",
    localFingerprint: leafFingerprint(synaravaValue),
    shopifyFingerprint: leafFingerprint(shopifySummary),
    node: "base",
  };
}

function compareCommerceWindows(windows: readonly SyncCommerceWindow[]): {
  leaves: SyncLeaf[];
  uncheckedCount: number;
} {
  const leaves: SyncLeaf[] = [];
  let uncheckedCount = 0;
  for (const window of windows) {
    if (window.shopifySnapshot == null && window.ourWindow == null) continue;
    if (window.ourWindow == null && window.shopifySnapshot != null) {
      leaves.push(adoptLeaf(window.resourceType, window.resourceId, "— Shopify window present —"));
      continue;
    }
    // Linked entity loaded for compare but Shopify window never fetched —
    // not a conflict, and not "all good". Count separately (audit: compare skip).
    if (window.shopifySnapshot == null) {
      uncheckedCount += 1;
      continue;
    }
    if (window.ourWindow == null) continue;
    const diffs = diffShopifyProjections(window.ourWindow, window.shopifySnapshot);
    if (window.resourceType === "PRODUCT" && diffs.some((d) => !isScopedCommerceFieldLabel(d.field))) {
      if (diffs.length > 0) {
        leaves.push(wholeItemCommerceLeaf(window.resourceId, diffs, {
          multiVariant: isMultiVariantCommerceWindow(window.ourWindow, window.shopifySnapshot),
        }));
      }
      continue;
    }
    for (const diff of diffs) leaves.push(commerceLeaf(window.resourceType, window.resourceId, diff));
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
    // Whole-item: read structured parts — never parse `Label: value` lines.
    const labels = leaf.fieldKey === WHOLE_ITEM_COMMERCE_FIELD_KEY
      ? (leaf.parts ?? []).map((part) => part.label)
      : [leaf.label];
    for (const label of labels) {
      const keys = COMMERCE_LABEL_TO_TRANSLATION_KEYS[label];
      if (!keys) continue;
      for (const key of keys) covered.add(`${leaf.resourceType}:${leaf.resourceId}:${key}`);
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
    // Two-way compare emits CONFLICT only. Legacy LOCAL_ONLY / SHOPIFY_ONLY
    // rows (enum kept; column unused for inventory) never become leaves.
    if (difference.kind !== "CONFLICT") continue;
    const locale = resolveLocaleCode(difference.locale, locales);
    const id = `${resourceType}:${difference.rootEntityId}:translation:${difference.locale}:${difference.fieldKey}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const meta = lookupTranslationContractMeta(difference.fieldKey, resourceType);
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
      allowedDirections: allowedDirectionsForLeaf({ kind: "translation", resourceType }),
      blockedReason: null,
      sourceId: difference.id,
      path: null,
      presenceSide: null,
      targetKind: difference.targetKind,
      localFingerprint: difference.localFingerprint,
      shopifyFingerprint: difference.shopifyFingerprint,
      contractKey: meta.contractKey,
      section: meta.section,
    });
  }
  return leaves;
}

function productPresenceLeaf(difference: CatalogPresenceDifference): SyncLeaf {
  const presenceSide: SyncPresenceSide = difference.kind === "SHOPIFY_ONLY" ? "SHOPIFY_ONLY" : "SYNARAVA_ONLY";
  const label = presenceSide === "SHOPIFY_ONLY"
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
    allowedDirections: allowedDirectionsForLeaf({
      kind: "presence",
      resourceType: "PRODUCT",
      presenceSide,
    }),
    blockedReason: null,
    sourceId: null,
    path: null,
    contractKey: PRESENCE_CONTRACT_KEY,
    section: "shopify",
    parts: null,
    displayName: identity?.name ?? difference.name,
    displayHandle: identity?.handle ?? difference.handle,
    displaySku: identity?.sku ?? difference.sku,
    presenceSide,
    targetKind: "NATIVE",
    localFingerprint: difference.localFingerprint,
    shopifyFingerprint: difference.shopifyFingerprint,
    node: "base",
  };
}

function collectionPresenceLeaf(difference: CollectionPresenceDifference): SyncLeaf {
  const presenceSide: SyncPresenceSide = difference.kind === "SHOPIFY_ONLY" ? "SHOPIFY_ONLY" : "SYNARAVA_ONLY";
  const label = presenceSide === "SHOPIFY_ONLY"
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
    allowedDirections: allowedDirectionsForLeaf({
      kind: "presence",
      resourceType: "COLLECTION",
      presenceSide,
    }),
    blockedReason: null,
    sourceId: null,
    path: null,
    contractKey: PRESENCE_CONTRACT_KEY,
    section: "shopify",
    parts: null,
    displayName: identity?.name ?? difference.name,
    displayHandle: identity?.handle ?? difference.handle,
    displaySku: identity?.sku ?? difference.sku,
    presenceSide,
    targetKind: "NATIVE",
    localFingerprint: difference.localFingerprint,
    shopifyFingerprint: difference.shopifyFingerprint,
    node: "base",
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

  // Presence replaces field-level commerce/translation for that entity.
  const commerceWindows = input.commerceWindows.filter(
    (window) => !presenceResourceIds.has(`${window.resourceType}:${window.resourceId}`),
  );
  const commerce = compareCommerceWindows(commerceWindows);
  leaves.push(...commerce.leaves);

  // Narrow EN drop lives in translationLeaves(commerce.leaves): skip default-locale
  // translation leaves only when a commerce leaf covers the same field.
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
