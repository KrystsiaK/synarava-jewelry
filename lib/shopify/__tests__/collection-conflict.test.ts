import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestReconcileDifferences: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  getLatestCollectionPresenceDifferences: vi.fn(),
}));

vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileDifferences: mocks.getLatestReconcileDifferences,
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
}));

vi.mock("@/lib/shopify/collection-presence-server", () => ({
  getLatestCollectionPresenceDifferences: mocks.getLatestCollectionPresenceDifferences,
}));

import {
  getCollectionCatalogConflict,
  listConflictedCollectionIds,
} from "@/lib/shopify/collection-conflict";

const locales = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
];

function difference(overrides: Record<string, unknown> = {}) {
  return {
    id: "diff-1",
    rootEntityType: "COLLECTION",
    rootEntityId: "collection-1",
    locale: "pt-PT",
    fieldKey: "title",
    fieldLabel: "Title",
    kind: "CONFLICT",
    targetKind: "NATIVE",
    localValue: "Local title",
    shopifyValue: "Shopify title",
    baseValue: null,
    localFingerprint: "local-fp",
    shopifyFingerprint: "shopify-fp",
    ...overrides,
  };
}

function presenceDiff(overrides: Record<string, unknown> = {}) {
  return {
    id: "shopify-collection:42",
    kind: "SHOPIFY_ONLY",
    localProductId: null,
    shopifyProductId: "gid://shopify/Collection/42",
    name: "Remote kits",
    handle: "remote-kits",
    sku: "",
    localFingerprint: "missing",
    shopifyFingerprint: "remote",
    remoteMissing: false,
    matchReason: null,
    localIdentity: null,
    shopifyIdentity: { name: "Remote kits", handle: "remote-kits", sku: "" },
    ...overrides,
  };
}

describe("getCollectionCatalogConflict", () => {
  beforeEach(() => {
    mocks.getPublishedStorefrontLocales.mockResolvedValue(locales);
    mocks.getLatestReconcileDifferences.mockResolvedValue([]);
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([]);
  });

  it("returns only COLLECTION CONFLICT translation fields for the collection", async () => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      difference(),
      difference({ id: "diff-2", rootEntityType: "PRODUCT", rootEntityId: "collection-1" }),
      difference({ id: "diff-3", kind: "LOCAL_ONLY" }),
      difference({ id: "diff-4", rootEntityId: "other" }),
      difference({ id: "diff-5", locale: "en", fieldKey: "description", fieldLabel: "Description" }),
    ]);

    const result = await getCollectionCatalogConflict("collection-1");
    expect(result.collectionId).toBe("collection-1");
    expect(result.fields).toHaveLength(2);
    expect(result.fields[0]).toMatchObject({
      fieldKey: "translation:pt-PT:title",
      label: "Title",
      origin: "TRANSLATION",
      scope: { kind: "LOCALE", code: "pt" },
      sourceId: "diff-1",
    });
    expect(result.fields[1]).toMatchObject({
      fieldKey: "translation:en:description",
      scope: { kind: "LOCALE", code: "en" },
    });
  });

  it("returns a one-direction presence field without inspecting translation diffs", async () => {
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([
      presenceDiff({ id: "collection-1" }),
    ]);
    mocks.getLatestReconcileDifferences.mockResolvedValue([difference()]);

    const result = await getCollectionCatalogConflict("collection-1");
    expect(result.fields).toEqual([
      expect.objectContaining({
        fieldKey: "presence:collection",
        origin: "PRESENCE",
        allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
      }),
    ]);
    expect(mocks.getLatestReconcileDifferences).not.toHaveBeenCalled();
  });
});

describe("listConflictedCollectionIds", () => {
  beforeEach(() => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([]);
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([]);
  });

  it("deduplicates collection ids with CONFLICT differences and presence", async () => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      difference(),
      difference({ id: "diff-2", fieldKey: "description" }),
      difference({ id: "diff-3", rootEntityId: "collection-2" }),
      difference({ id: "diff-4", rootEntityType: "PRODUCT", rootEntityId: "product-1" }),
    ]);
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([
      presenceDiff(),
      presenceDiff({ id: "collection-1", kind: "SYNARAVA_ONLY" }),
    ]);
    await expect(listConflictedCollectionIds()).resolves.toEqual([
      "collection-1",
      "collection-2",
      "shopify-collection:42",
    ]);
  });
});
