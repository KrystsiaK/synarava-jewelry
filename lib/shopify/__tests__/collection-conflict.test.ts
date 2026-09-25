import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestReconcileDifferences: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
}));

vi.mock("@/lib/shopify/reconciliation-run", () => ({
  getLatestReconcileDifferences: mocks.getLatestReconcileDifferences,
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getPublishedStorefrontLocales: mocks.getPublishedStorefrontLocales,
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

describe("getCollectionCatalogConflict", () => {
  beforeEach(() => {
    mocks.getPublishedStorefrontLocales.mockResolvedValue(locales);
    mocks.getLatestReconcileDifferences.mockResolvedValue([]);
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
});

describe("listConflictedCollectionIds", () => {
  it("deduplicates collection ids with CONFLICT differences", async () => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      difference(),
      difference({ id: "diff-2", fieldKey: "description" }),
      difference({ id: "diff-3", rootEntityId: "collection-2" }),
      difference({ id: "diff-4", rootEntityType: "PRODUCT", rootEntityId: "product-1" }),
    ]);
    await expect(listConflictedCollectionIds()).resolves.toEqual(["collection-1", "collection-2"]);
  });
});
