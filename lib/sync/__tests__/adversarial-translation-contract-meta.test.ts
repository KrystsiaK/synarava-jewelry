/**
 * SYNC-ADV-001 — translation leaves carry registry-driven contractKey/section.
 */
import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { lookupTranslationContractMeta } from "@/lib/sync/field-registry";

describe("translation leaf contract metadata (SYNC-ADV-001)", () => {
  it("lookupTranslationContractMeta maps title to commerce essentials", () => {
    expect(lookupTranslationContractMeta("title", "PRODUCT")).toEqual({
      contractKey: "title",
      section: "essentials",
    });
    expect(lookupTranslationContractMeta("title", "COLLECTION")).toEqual({
      contractKey: "collection.title",
      section: "essentials",
    });
    expect(lookupTranslationContractMeta("symbolismBody", "PRODUCT")).toEqual({
      contractKey: "translation.symbolismBody",
      section: "essentials",
    });
  });

  it("translation leaves expose contractKey and section", () => {
    const result = compareSyncState({
      commerceWindows: [],
      translationDifferences: [{
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
      }],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: null,
    });
    const translation = result.leaves.filter((leaf) => leaf.kind === "translation");
    expect(translation).toHaveLength(1);
    expect(translation[0]!.contractKey).toBe("title");
    expect(translation[0]!.section).toBe("essentials");
  });
});
