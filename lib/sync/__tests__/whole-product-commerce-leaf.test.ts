import { describe, expect, it } from "vitest";

import { MULTI_VARIANT_PUSH_BLOCKED_REASON } from "@/lib/shopify/catalog-conflict-policy";
import {
  catalogConflictSignalsFromSyncResult,
  selectAdminNavSyncCounts,
  selectSyncCounts,
  slice,
} from "@/lib/sync";
import { compareSyncState } from "@/lib/sync/compare";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
  { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
] as const;

function compareProduct(
  ourWindow: unknown,
  shopifySnapshot: unknown,
  translationDifferences: Parameters<typeof compareSyncState>[0]["translationDifferences"] = [],
) {
  return compareSyncState({
    commerceWindows: [{
      resourceType: "PRODUCT",
      resourceId: "p1",
      ourWindow,
      shopifySnapshot,
    }],
    translationDifferences,
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    connected: true,
    checkedAt: "2026-10-26T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-26T12:01:00.000Z"),
  });
}

const PRICE_TAGS_STATUS_LOCAL = {
  status: "ACTIVE",
  tags: ["a"],
  variants: [{ id: "v1", price: "10.00" }],
};

const PRICE_TAGS_STATUS_SHOPIFY = {
  status: "DRAFT",
  tags: ["b"],
  variants: [{ id: "v1", price: "12.00" }],
};

describe("product whole-product commerce leaf (PR-A3)", () => {
  it("multi-variant whole-item leaf allows Take Shopify only (Keep ours blocked)", () => {
    const result = compareProduct(
      {
        status: "ACTIVE",
        tags: ["a"],
        variants: [
          { id: "v1", price: "10.00" },
          { id: "v2", price: "20.00" },
        ],
      },
      {
        status: "DRAFT",
        tags: ["b"],
        variants: [
          { id: "v1", price: "12.00" },
          { id: "v2", price: "22.00" },
        ],
      },
    );
    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce).toHaveLength(1);
    expect(commerce[0]).toMatchObject({
      fieldKey: "commerce:whole-item",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
      blockedReason: MULTI_VARIANT_PUSH_BLOCKED_REASON,
    });
  });

  it("Price + Tags + Status → exactly ONE commerce:whole-item leaf", () => {
    const result = compareProduct(PRICE_TAGS_STATUS_LOCAL, PRICE_TAGS_STATUS_SHOPIFY);
    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce).toHaveLength(1);
    expect(commerce[0]).toMatchObject({
      fieldKey: "commerce:whole-item",
      locale: null,
      node: "base",
      label: "Product data (3 fields)",
      blockedReason: expect.any(String),
      allowedDirections: [],
    });
    expect(commerce[0]!.synaravaValue.split("\n").toSorted()).toEqual([
      "Price: 10",
      "Status: ACTIVE",
      "Tags: a",
    ]);
    expect(commerce[0]!.shopifyValue.split("\n").toSorted()).toEqual([
      "Price: 12",
      "Status: DRAFT",
      "Tags: b",
    ]);
  });

  it("counters / signals / base tab show 1; PT/RU siblings stay separate", () => {
    const result = compareProduct(PRICE_TAGS_STATUS_LOCAL, PRICE_TAGS_STATUS_SHOPIFY, [
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
    ]);

    expect(result.leaves).toHaveLength(3);
    expect(slice(result, { entityType: "PRODUCT", entityId: "p1", node: "base" })).toHaveLength(1);
    expect(slice(result, { entityType: "PRODUCT", entityId: "p1", node: "pt" })).toHaveLength(1);
    expect(slice(result, { entityType: "PRODUCT", entityId: "p1", node: "ru" })).toHaveLength(1);

    expect(selectAdminNavSyncCounts(result).products).toBe(3);
    expect(selectSyncCounts(result, {
      kind: "editorBanner",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(3);
    expect(selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(3);
    expect(catalogConflictSignalsFromSyncResult(result, "PRODUCT").products.p1?.leafCount).toBe(3);
  });

  it("changing any constituent changes aggregate fingerprints (preview stale)", () => {
    const base = compareProduct(PRICE_TAGS_STATUS_LOCAL, PRICE_TAGS_STATUS_SHOPIFY);
    const leaf = base.leaves.find((item) => item.fieldKey === "commerce:whole-item")!;
    const priceOnlyChange = compareProduct(
      PRICE_TAGS_STATUS_LOCAL,
      { ...PRICE_TAGS_STATUS_SHOPIFY, variants: [{ id: "v1", price: "99.00" }] },
    );
    const changed = priceOnlyChange.leaves.find((item) => item.fieldKey === "commerce:whole-item")!;
    expect(changed.localFingerprint).toBe(leaf.localFingerprint);
    expect(changed.shopifyFingerprint).not.toBe(leaf.shopifyFingerprint);
    // Fingerprints are not the visible multi-line summary.
    expect(leaf.localFingerprint).not.toBe(
      // sha of summary would differ; ensure hash input is not the display string alone
      leaf.synaravaValue,
    );
  });

  it("two media diffs under one contractKey: changing the second changes the fingerprint", () => {
    const our = {
      status: "ACTIVE",
      media: [
        { id: "m1", alt: "Front", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } },
        { id: "m2", alt: "Side", preview: { image: { url: "https://cdn.shopify.com/b.jpg" } } },
      ],
    };
    const shopifyBase = {
      status: "DRAFT",
      media: [
        { id: "m1", alt: "Front remote", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } },
        { id: "m2", alt: "Side remote", preview: { image: { url: "https://cdn.shopify.com/b.jpg" } } },
      ],
    };
    const first = compareProduct(our, shopifyBase);
    const leaf = first.leaves.find((item) => item.fieldKey === "commerce:whole-item")!;
    expect(leaf).toBeDefined();
    const mediaParts = (leaf.parts ?? []).filter((part) => part.contractKey === "media");
    expect(mediaParts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(mediaParts.map((part) => part.path)).size).toBe(mediaParts.length);

    const shopifySecondChanged = {
      ...shopifyBase,
      media: [
        shopifyBase.media[0],
        { id: "m2", alt: "Side CHANGED", preview: { image: { url: "https://cdn.shopify.com/b.jpg" } } },
      ],
    };
    const second = compareProduct(our, shopifySecondChanged);
    const changed = second.leaves.find((item) => item.fieldKey === "commerce:whole-item")!;
    expect(changed.shopifyFingerprint).not.toBe(leaf.shopifyFingerprint);
    expect(changed.localFingerprint).toBe(leaf.localFingerprint);
  });

  it("all-scoped diffs remain individually selectable (no whole-item leaf)", () => {
    const result = compareProduct(
      { title: "Local", handle: "ring", vendor: "Us", variants: [{ id: "v1", price: "10.00" }] },
      { title: "Remote", handle: "ring", vendor: "Them", variants: [{ id: "v1", price: "12.00" }] },
    );
    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce.every((leaf) => leaf.fieldKey !== "commerce:whole-item")).toBe(true);
    expect(commerce.map((leaf) => leaf.label).toSorted()).toEqual(["Name", "Price", "Vendor"]);
    expect(commerce.every((leaf) => leaf.blockedReason == null)).toBe(true);
  });

  it("after windows match, aggregate leaf disappears", () => {
    const before = compareProduct(PRICE_TAGS_STATUS_LOCAL, PRICE_TAGS_STATUS_SHOPIFY);
    expect(before.leaves.some((leaf) => leaf.fieldKey === "commerce:whole-item")).toBe(true);
    const after = compareProduct(PRICE_TAGS_STATUS_LOCAL, PRICE_TAGS_STATUS_LOCAL);
    expect(after.leaves.some((leaf) => leaf.fieldKey === "commerce:whole-item")).toBe(false);
    expect(slice(after, { entityType: "PRODUCT", entityId: "p1" })).toHaveLength(0);
  });

  it("EN translation dedupe still uses constituent Name inside the aggregate", () => {
    const result = compareProduct(
      { title: "Local", status: "ACTIVE", tags: ["a"] },
      { title: "Remote", status: "DRAFT", tags: ["b"] },
      [
        {
          id: "div-en",
          rootEntityType: "PRODUCT",
          rootEntityId: "p1",
          locale: "en",
          fieldKey: "title",
          fieldLabel: "Title",
          kind: "CONFLICT",
          localValue: "Local",
          shopifyValue: "Remote",
          localFingerprint: "a",
          shopifyFingerprint: "b",
          targetKind: "NATIVE",
        },
      ],
    );
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toHaveLength(1);
    expect(result.leaves.some((leaf) => leaf.kind === "translation")).toBe(false);
  });

  it("collections stay per-field (no whole-item group)", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c1",
        ourWindow: { title: "Local", handle: "x", descriptionHtml: "<p>A</p>" },
        shopifySnapshot: { title: "Remote", handle: "x", descriptionHtml: "<p>B</p>" },
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-26T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-26T12:01:00.000Z"),
    });
    expect(result.leaves.every((leaf) => leaf.fieldKey !== "commerce:whole-item")).toBe(true);
    expect(result.leaves.map((leaf) => leaf.label).toSorted()).toEqual(["Description", "Name"]);
  });
});
