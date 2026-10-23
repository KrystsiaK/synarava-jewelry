import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";

/**
 * Characterization: ONE compare over commerce + translation + presence.
 * Locks leaf identity and that presence replaces field-level rows for an entity.
 */

describe("compareSyncState (characterization)", () => {
  it("diffs commerce windows with diffShopifyProjections (title diverge)", () => {
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "PRODUCT",
          resourceId: "p1",
          workingSnapshot: { title: "Local", handle: "ring" },
          shopifySnapshot: { title: "Remote", handle: "ring" },
        },
      ],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      runTrigger: "MANUAL",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(result.state).toBe("ready");
    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]).toMatchObject({
      resourceType: "PRODUCT",
      resourceId: "p1",
      kind: "commerce",
      locale: null,
      label: "Name",
    });
  });

  it("emits adopt leaf when workingSnapshot is missing", () => {
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "PRODUCT",
          resourceId: "p1",
          workingSnapshot: null,
          shopifySnapshot: { title: "Remote" },
        },
      ],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]?.fieldKey).toBe("commerce:adopt-shopify");
    expect(result.leaves[0]?.allowedDirections).toEqual(["SHOPIFY_TO_SYNARAVA"]);
  });

  it("includes CONFLICT translation leaves and maps Shopify locale to registry code", () => {
    const result = compareSyncState({
      commerceWindows: [],
      translationDifferences: [
        {
          id: "div-1",
          rootEntityType: "PRODUCT",
          rootEntityId: "p1",
          locale: "pt-PT",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "CONFLICT",
          localValue: "Local PT",
          shopifyValue: "Remote PT",
          localFingerprint: "a",
          shopifyFingerprint: "b",
          targetKind: "NATIVE",
        },
        {
          id: "div-legacy",
          rootEntityType: "PRODUCT",
          rootEntityId: "p1",
          locale: "ru",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "LOCAL_ONLY",
          localValue: "x",
          shopifyValue: "",
          localFingerprint: "a",
          shopifyFingerprint: "b",
          targetKind: "NATIVE",
        },
      ],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
        { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
      ],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]).toMatchObject({
      kind: "translation",
      locale: "pt",
      resourceId: "p1",
      sourceId: "div-1",
    });
  });

  it("presence replaces commerce/translation leaves for the same resource", () => {
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "PRODUCT",
          resourceId: "p1",
          workingSnapshot: { title: "A" },
          shopifySnapshot: { title: "B" },
        },
      ],
      translationDifferences: [
        {
          id: "div-1",
          rootEntityType: "PRODUCT",
          rootEntityId: "p1",
          locale: "en",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "CONFLICT",
          localValue: "A",
          shopifyValue: "B",
          localFingerprint: "a",
          shopifyFingerprint: "b",
          targetKind: "NATIVE",
        },
      ],
      productPresence: [
        {
          id: "p1",
          kind: "SYNARAVA_ONLY",
          localProductId: "p1",
          shopifyProductId: null,
          name: "Only here",
          handle: "only",
          sku: "SKU",
          localFingerprint: "local",
          shopifyFingerprint: "missing",
          remoteMissing: false,
          matchReason: null,
          localIdentity: { name: "Only here", handle: "only", sku: "SKU" },
          shopifyIdentity: null,
        },
      ],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]?.kind).toBe("presence");
  });

  it("includes collection translation CONFLICT leaves (collections keep one-sided kinds until re-check)", () => {
    const result = compareSyncState({
      commerceWindows: [],
      translationDifferences: [
        {
          id: "c-div",
          rootEntityType: "COLLECTION",
          rootEntityId: "c1",
          locale: "en",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "LOCAL_ONLY",
          localValue: "Local",
          shopifyValue: "",
          localFingerprint: "a",
          shopifyFingerprint: "b",
          targetKind: "NATIVE",
        },
      ],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0]).toMatchObject({
      resourceType: "COLLECTION",
      resourceId: "c1",
      kind: "translation",
    });
  });
});
