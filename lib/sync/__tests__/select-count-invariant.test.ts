import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { assertCountInvariant, slice } from "@/lib/sync/select";
import type { SyncResult } from "@/lib/sync/types";

function fixture(): SyncResult {
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
      {
        id: "div-ru",
        rootEntityType: "PRODUCT",
        rootEntityId: "p1",
        locale: "ru",
        fieldKey: "title",
        fieldLabel: "Title",
        kind: "CONFLICT",
        localValue: "Кольцо",
        shopifyValue: "Ring",
        localFingerprint: "c",
        shopifyFingerprint: "d",
        targetKind: "NATIVE",
      },
    ],
    productPresence: [],
    collectionPresence: [],
    locales: [
      { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
      { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
    ],
    connected: true,
    checkedAt: "2026-10-23T10:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-23T10:01:00.000Z"),
  });
}

describe("assertCountInvariant / slice", () => {
  it("count(entity) == count(base) + sum(locales); shared commerce never under locale nodes", () => {
    const result = fixture();
    // 2 commerce (title + vendor) under base + 2 translations
    expect(slice(result, { entityId: "p1" }).length).toBe(4);
    expect(slice(result, { entityId: "p1", node: "base" }).length).toBe(2);
    expect(slice(result, { entityId: "p1", node: "pt" }).length).toBe(1);
    expect(slice(result, { entityId: "p1", node: "ru" }).length).toBe(1);

    expect(() => assertCountInvariant(result, "p1", ["pt", "ru"])).not.toThrow();

    for (const leaf of slice(result, { entityId: "p1", node: "pt" })) {
      expect(leaf.kind).toBe("translation");
    }
  });
});
