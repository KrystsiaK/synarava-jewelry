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

  it("page EN title conflict still appears (no commerce leaf covers PAGE)", () => {
    const result = compareSyncState({
      commerceWindows: [],
      translationDifferences: [
        {
          id: "p-div",
          rootEntityType: "PAGE",
          rootEntityId: "page-1",
          locale: "en",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "CONFLICT",
          localValue: "Home",
          shopifyValue: "Home EN",
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
    expect(result.leaves[0]?.id).toBe("PAGE:page-1:translation:en:title");
    expect(result.leaves[0]?.kind).toBe("translation");
  });

  it("drops default-locale translation leaf only when commerce already covers that field", () => {
    const locales = [
      { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
    ];
    const translation = (
      locale: string,
      fieldKey: string,
      id: string,
      fieldLabel = "Name",
    ) => ({
      id,
      rootEntityType: "COLLECTION" as const,
      rootEntityId: "c1",
      locale,
      fieldKey,
      fieldLabel,
      kind: "CONFLICT" as const,
      localValue: fieldKey === "subtitle" ? "Local subtitle" : "Pets",
      shopifyValue: fieldKey === "subtitle" ? "Shopify subtitle" : "Pets & Animals",
      localFingerprint: "a",
      shopifyFingerprint: "b",
      targetKind: "NATIVE" as const,
    });
    const result = compareSyncState({
      commerceWindows: [
        {
          resourceType: "COLLECTION",
          resourceId: "c1",
          workingSnapshot: { title: "Pets", handle: "pets" },
          shopifySnapshot: { title: "Pets & Animals", handle: "pets" },
        },
      ],
      translationDifferences: [
        translation("en", "name", "d-en"),
        translation("pt-PT", "name", "d-pt"),
        translation("en", "subtitle", "d-en-subtitle", "Subtitle"),
      ],
      productPresence: [],
      collectionPresence: [],
      locales,
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    // commerce Name once; EN name dropped (covered); EN subtitle + PT name stay.
    const ids = result.leaves.map((leaf) => leaf.id);
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce" && leaf.label === "Name")).toHaveLength(1);
    expect(ids).not.toContain("COLLECTION:c1:translation:en:name");
    expect(ids).toContain("COLLECTION:c1:translation:en:subtitle");
    expect(ids).toContain("COLLECTION:c1:translation:pt-PT:name");
    expect(ids).toHaveLength(3);
  });
});
