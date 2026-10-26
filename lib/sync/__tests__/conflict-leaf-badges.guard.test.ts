import { describe, expect, it } from "vitest";

import {
  catalogConflictSignalsFromSyncResult,
  selectAdminNavSyncCounts,
  selectSyncCounts,
  slice,
} from "@/lib/sync";
import type { SyncResult } from "@/lib/sync/types";
import { compareSyncState } from "@/lib/sync/compare";

/**
 * Guard: every admin counter is LEAF conflicts from one compare.
 * Fixture: 1 product · 2 base conflicts + 1 PT conflict → all surfaces show 3.
 */
function oneProductThreeLeaves(): SyncResult {
  return compareSyncState({
    commerceWindows: [
      {
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: { title: "Local", handle: "ring", vendor: "Us" },
        shopifySnapshot: { title: "Remote", handle: "ring", vendor: "Them" },
      },
    ],
    translationDifferences: [
      {
        id: "div-pt",
        rootEntityType: "PRODUCT",
        rootEntityId: "p1",
        locale: "pt-PT",
        fieldKey: "title",
        fieldLabel: "Title",
        kind: "CONFLICT",
        localValue: "Anel",
        shopifyValue: "Ring",
        localFingerprint: "a",
        shopifyFingerprint: "b",
        targetKind: "NATIVE",
      },
    ],
    productPresence: [],
    collectionPresence: [],
    locales: [
      { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
    ],
    connected: true,
    checkedAt: "2026-10-26T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-26T12:01:00.000Z"),
  });
}

describe("conflict leaf badges — menu ≡ banner ≡ entity ≡ table", () => {
  it("1 product / 2 base + 1 PT → menu, banner, entity count, table chip all = 3", () => {
    const result = oneProductThreeLeaves();
    expect(result.leaves).toHaveLength(3);

    const base = slice(result, { entityType: "PRODUCT", entityId: "p1", node: "base" }).length;
    const pt = slice(result, { entityType: "PRODUCT", entityId: "p1", node: "pt" }).length;
    expect(base).toBe(2);
    expect(pt).toBe(1);
    expect(base + pt).toBe(3);

    const menuBadge = selectAdminNavSyncCounts(result).products;
    const banner = catalogConflictSignalsFromSyncResult(result, "PRODUCT");
    const entityCount = selectSyncCounts(result, {
      kind: "editorBanner",
      resourceType: "PRODUCT",
      resourceId: "p1",
    });
    const tableChip = selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    });
    const navViaSelect = selectSyncCounts(result, { kind: "nav" }).products;

    expect(menuBadge).toBe(3);
    expect(banner.totalCount).toBe(3);
    expect(banner.products.p1?.leafCount).toBe(3);
    expect(entityCount).toBe(3);
    expect(tableChip).toBe(3);
    expect(navViaSelect).toBe(3);
    expect(new Set([menuBadge, banner.totalCount, entityCount, tableChip, navViaSelect])).toEqual(
      new Set([3]),
    );
  });
});
