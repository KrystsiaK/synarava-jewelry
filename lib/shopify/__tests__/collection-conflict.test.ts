import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestReconcileDifferences: vi.fn(),
  getPublishedStorefrontLocales: vi.fn(),
  getLatestCollectionPresenceDifferences: vi.fn(),
  findUniqueCollection: vi.fn(),
  findManyCollections: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: {
      findUnique: mocks.findUniqueCollection,
      findMany: mocks.findManyCollections,
    },
  },
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
    mocks.findUniqueCollection.mockResolvedValue({
      id: "collection-1",
      shopifyCollectionId: "gid://shopify/Collection/1",
      workingSnapshot: {
        title: "Local name",
        handle: "local-handle",
        descriptionHtml: "<p>Local</p>",
        seo: { title: "Local SEO", description: null },
      },
      shopifySnapshot: {
        title: "Shopify name",
        handle: "shopify-handle",
        descriptionHtml: "<p>Shopify</p>",
        seo: { title: "Shopify SEO", description: null },
      },
    });
    mocks.findManyCollections.mockResolvedValue([]);
  });

  it("includes SHARED commerce fields from existing windows (title, handle, description, seo)", async () => {
    const result = await getCollectionCatalogConflict("collection-1");

    const commerce = result.fields.filter((field) => field.origin === "COMMERCE");
    expect(commerce.map((field) => field.label).sort()).toEqual([
      "Description",
      "Handle",
      "Name",
      "SEO title",
    ]);
    expect(commerce.every((field) => field.scope.kind === "SHARED")).toBe(true);
    expect(commerce.every((field) =>
      field.allowedDirections.includes("SHOPIFY_TO_SYNARAVA")
      && field.allowedDirections.includes("SYNARAVA_TO_SHOPIFY"),
    )).toBe(true);
    expect(commerce.find((field) => field.label === "Name")).toMatchObject({
      synaravaValue: "Local name",
      shopifyValue: "Shopify name",
      blockedReason: null,
    });
  });

  it("does not surface Adopt Shopify when columns can build a working window", async () => {
    mocks.findUniqueCollection.mockResolvedValue({
      id: "collection-1",
      shopifyCollectionId: "gid://shopify/Collection/1",
      workingSnapshot: null,
      shopifySnapshot: {
        title: "Shopify name",
        handle: "shopify-handle",
        descriptionHtml: "",
        seo: { title: null, description: null },
      },
      name: "Local name",
      slug: "local-handle",
      description: null,
      seoTitle: null,
      seoDescription: null,
    });

    const result = await getCollectionCatalogConflict("collection-1");
    const commerce = result.fields.filter((field) => field.origin === "COMMERCE");
    expect(commerce.some((field) => field.fieldKey === "commerce:adopt-shopify")).toBe(false);
    expect(commerce.some((field) => field.label === "Name" || field.label === "Handle")).toBe(true);
  });

  it("returns every unresolved COLLECTION translation field, including one-sided changes", async () => {
    // Matching windows so commerce rows stay out of this translation-focused case.
    mocks.findUniqueCollection.mockResolvedValue({
      id: "collection-1",
      shopifyCollectionId: "gid://shopify/Collection/1",
      workingSnapshot: {
        title: "Same",
        handle: "same",
        descriptionHtml: "<p>Same</p>",
        seo: { title: null, description: null },
      },
      shopifySnapshot: {
        title: "Same",
        handle: "same",
        descriptionHtml: "<p>Same</p>",
        seo: { title: null, description: null },
      },
    });
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      difference(),
      difference({ id: "diff-2", rootEntityType: "PRODUCT", rootEntityId: "collection-1" }),
      difference({ id: "diff-3", kind: "LOCAL_ONLY", fieldKey: "seoTitle", fieldLabel: "SEO title" }),
      difference({ id: "diff-4", rootEntityId: "other" }),
      difference({ id: "diff-5", locale: "en", fieldKey: "description", fieldLabel: "Description" }),
    ]);

    const result = await getCollectionCatalogConflict("collection-1");
    expect(result.collectionId).toBe("collection-1");
    const translations = result.fields.filter((field) => field.origin === "TRANSLATION");
    expect(translations).toHaveLength(3);
    expect(translations.map((field) => field.fieldKey)).toEqual([
      "translation:pt-PT:title",
      "translation:pt-PT:seoTitle",
      "translation:en:description",
    ]);
    expect(translations[0]).toMatchObject({
      fieldKey: "translation:pt-PT:title",
      label: "Title",
      origin: "TRANSLATION",
      scope: { kind: "LOCALE", code: "pt" },
      sourceId: "diff-1",
    });
    expect(translations[1]).toMatchObject({
      fieldKey: "translation:pt-PT:seoTitle",
      label: "SEO title",
      sourceId: "diff-3",
    });
    expect(translations[2]).toMatchObject({
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

  it("allows both push and delete for a Synarava-only presence field", async () => {
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([
      presenceDiff({
        id: "collection-1",
        kind: "SYNARAVA_ONLY",
        localProductId: "collection-1",
        shopifyProductId: null,
        localIdentity: { name: "Jewelry Making", handle: "jewelry-making", sku: "" },
        shopifyIdentity: null,
      }),
    ]);

    const result = await getCollectionCatalogConflict("collection-1");
    expect(result.fields[0]).toMatchObject({
      fieldKey: "presence:collection",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    });
  });
});

describe("listConflictedCollectionIds", () => {
  beforeEach(() => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([]);
    mocks.getLatestCollectionPresenceDifferences.mockResolvedValue([]);
    mocks.findManyCollections.mockResolvedValue([]);
  });

  it("deduplicates collection ids for every unresolved kind and presence", async () => {
    mocks.getLatestReconcileDifferences.mockResolvedValue([
      difference(),
      difference({ id: "diff-2", fieldKey: "description" }),
      difference({ id: "diff-3", rootEntityId: "collection-2", kind: "SHOPIFY_ONLY" }),
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

  it("includes collections with commerce window CONFLICT syncStatus", async () => {
    mocks.findManyCollections.mockResolvedValue([{ id: "commerce-conflict-1" }]);
    await expect(listConflictedCollectionIds()).resolves.toEqual(["commerce-conflict-1"]);
  });
});
