import { describe, expect, it } from "vitest";

import {
  catalogConflictSignalsFromSyncResult,
  countConflictedItems,
  selectAdminNavSyncCounts,
} from "@/lib/sync";
import type { SyncLeaf, SyncResult } from "@/lib/sync/types";
import { emptySyncResult } from "@/lib/sync/types";

function leaf(
  overrides: Partial<SyncLeaf> & Pick<SyncLeaf, "resourceType" | "resourceId" | "fieldKey" | "kind">,
): SyncLeaf {
  return {
    id: `${overrides.resourceType}:${overrides.resourceId}:${overrides.fieldKey}`,
    locale: null,
    label: overrides.fieldKey,
    synaravaValue: "local",
    shopifyValue: "remote",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: null,
    ...overrides,
  };
}

/** 3 Only-in-Synarava + 1 Only-in-Shopify + 1 collection with two conflict leaves → 5. */
function collectionsBadgeFixture(): SyncResult {
  return emptySyncResult({
    state: "ready",
    checkedAt: "2026-10-25T12:00:00.000Z",
    leaves: [
      leaf({
        resourceType: "COLLECTION",
        resourceId: "c-local-1",
        kind: "presence",
        fieldKey: "presence:collection",
        label: "Collection exists only in Synarava",
      }),
      leaf({
        resourceType: "COLLECTION",
        resourceId: "c-local-2",
        kind: "presence",
        fieldKey: "presence:collection",
        label: "Collection exists only in Synarava",
      }),
      leaf({
        resourceType: "COLLECTION",
        resourceId: "c-local-3",
        kind: "presence",
        fieldKey: "presence:collection",
        label: "Collection exists only in Synarava",
      }),
      leaf({
        resourceType: "COLLECTION",
        resourceId: "shopify-collection:99",
        kind: "presence",
        fieldKey: "presence:collection",
        label: "Collection exists only in Shopify",
      }),
      // One collection, TWO leaves — must count as 1 item, not 2.
      leaf({
        resourceType: "COLLECTION",
        resourceId: "c-dual",
        kind: "commerce",
        fieldKey: "commerce:title",
        label: "Name",
      }),
      leaf({
        resourceType: "COLLECTION",
        resourceId: "c-dual",
        kind: "translation",
        fieldKey: "translation:pt:title",
        label: "Title",
        locale: "pt",
      }),
    ],
  });
}

describe("countConflictedItems — one definition for nav + banner", () => {
  it("counts DISTINCT collections: 3 Synarava-only + 1 Shopify-only + 1 dual-leaf = 5", () => {
    const result = collectionsBadgeFixture();
    // Leaf tally would be 6; item tally is 5.
    expect(result.leaves).toHaveLength(6);
    expect(countConflictedItems(result, "COLLECTION")).toBe(5);

    const nav = selectAdminNavSyncCounts(result);
    const banner = catalogConflictSignalsFromSyncResult(result, "COLLECTION");
    expect(nav.collections).toBe(5);
    expect(banner.totalCount).toBe(5);
    expect(nav.collections).toBe(banner.totalCount);
  });

  it("property: for any SyncResult, nav section === banner.totalCount for products and collections", () => {
    const fixtures: SyncResult[] = [
      collectionsBadgeFixture(),
      emptySyncResult({ state: "ready", leaves: [] }),
      emptySyncResult({
        state: "ready",
        leaves: [
          leaf({
            resourceType: "PRODUCT",
            resourceId: "p1",
            kind: "commerce",
            fieldKey: "commerce:title",
          }),
          leaf({
            resourceType: "PRODUCT",
            resourceId: "p1",
            kind: "translation",
            fieldKey: "translation:en:title",
            locale: "en",
          }),
          leaf({
            resourceType: "PRODUCT",
            resourceId: "p2",
            kind: "presence",
            fieldKey: "presence:product",
            label: "Product exists only in Shopify",
          }),
          leaf({
            resourceType: "COLLECTION",
            resourceId: "c1",
            kind: "commerce",
            fieldKey: "commerce:handle",
          }),
        ],
      }),
      emptySyncResult({
        state: "ready",
        leaves: Array.from({ length: 5 }, (_, index) =>
          leaf({
            resourceType: index % 2 === 0 ? "PRODUCT" : "COLLECTION",
            resourceId: `shared-${Math.floor(index / 2)}`,
            kind: "commerce",
            fieldKey: `commerce:field-${index}`,
          })),
      }),
    ];

    for (const result of fixtures) {
      const nav = selectAdminNavSyncCounts(result);
      const productBanner = catalogConflictSignalsFromSyncResult(result, "PRODUCT");
      const collectionBanner = catalogConflictSignalsFromSyncResult(result, "COLLECTION");
      expect(nav.products).toBe(productBanner.totalCount);
      expect(nav.collections).toBe(collectionBanner.totalCount);
      expect(nav.products).toBe(countConflictedItems(result, "PRODUCT"));
      expect(nav.collections).toBe(countConflictedItems(result, "COLLECTION"));
    }
  });
});
