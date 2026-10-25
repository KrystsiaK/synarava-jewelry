import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { selectSyncCounts } from "@/lib/sync/select";
import type { SyncResult } from "@/lib/sync/types";

/**
 * Contract: nav badge, list chip, editor banner, and locale tab derive from
 * ONE selector over the same SyncResult — identical numbers for the same fixture.
 */

function singleProductFixture(): SyncResult {
  return compareSyncState({
    commerceWindows: [
      {
        resourceType: "PRODUCT",
        resourceId: "p1",
        workingSnapshot: { title: "Local", handle: "ring", vendor: "Us" },
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
    checkedAt: "2026-10-23T10:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-23T10:01:00.000Z"),
  });
}

describe("selectSyncCounts identical surfaces", () => {
  it("nav counts DISTINCT items; per-item chips count leaves on that resource", () => {
    const result = singleProductFixture();
    // 2 commerce (title + vendor) + 1 translation = 3 leaves on ONE product
    expect(result.leaves).toHaveLength(3);

    const nav = selectSyncCounts(result, { kind: "nav" });
    const listChip = selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    });
    const editorBanner = selectSyncCounts(result, {
      kind: "editorBanner",
      resourceType: "PRODUCT",
      resourceId: "p1",
    });
    // Shared commerce counts under every locale shell; + pt translation.
    const localeTab = selectSyncCounts(result, {
      kind: "localeTab",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "pt",
    });

    expect(nav.products).toBe(1);
    expect(nav.total).toBe(1);
    expect(listChip).toBe(3);
    expect(editorBanner).toBe(3);
    expect(localeTab).toBe(3);
    // Per-item surfaces that show leaf depth still agree.
    expect(new Set([listChip, editorBanner, localeTab]).size).toBe(1);
  });

  it("does not invent a second count for a different product id", () => {
    const result = singleProductFixture();
    expect(
      selectSyncCounts(result, {
        kind: "listChip",
        resourceType: "PRODUCT",
        resourceId: "other",
      }),
    ).toBe(0);
  });
});
