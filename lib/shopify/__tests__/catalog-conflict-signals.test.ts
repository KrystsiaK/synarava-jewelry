import { describe, expect, it } from "vitest";

import { persistPayloadForCommerceInspection } from "@/lib/shopify/catalog-conflict-policy";
import { buildCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const locales = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
  { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
  { code: "de", shopifyLocale: "de", name: "German", nativeName: "Deutsch", isDefault: false, sortOrder: 3 },
];

const difference = (rootEntityId: string, locale: string, fieldKey: string, kind = "CONFLICT") => ({
  rootEntityType: "PRODUCT" as const, rootEntityId, locale, fieldKey, kind,
});

describe("buildCatalogConflictSignals", () => {
  it("includes one-sided catalog products with their identity and allowed direction", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: [],
      differences: [],
      presenceDifferences: [
        {
          id: "shopify:42",
          kind: "SHOPIFY_ONLY",
          localProductId: null,
          shopifyProductId: "gid://shopify/Product/42",
          name: "Shopify-only necklace",
          handle: "shopify-only-necklace",
          sku: "SO-42",
          localFingerprint: "missing",
          shopifyFingerprint: "remote",
          remoteMissing: false,
          matchReason: null,
          localIdentity: null,
          shopifyIdentity: { name: "Shopify-only necklace", handle: "shopify-only-necklace", sku: "SO-42" },
        },
        {
          id: "local-7",
          kind: "SYNARAVA_ONLY",
          localProductId: "local-7",
          shopifyProductId: null,
          name: "Synarava-only ring",
          handle: "synarava-only-ring",
          sku: "LO-7",
          localFingerprint: "local",
          shopifyFingerprint: "missing",
          remoteMissing: false,
          matchReason: null,
          localIdentity: { name: "Synarava-only ring", handle: "synarava-only-ring", sku: "LO-7" },
          shopifyIdentity: null,
        },
      ],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      now: new Date("2026-09-23T10:01:00.000Z"),
    });

    expect(result.totalCount).toBe(2);
    expect(result.products["shopify:42"]).toMatchObject({
      presence: "SHOPIFY_ONLY",
      name: "Shopify-only necklace",
      sku: "SO-42",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    });
    expect(result.products["local-7"]).toMatchObject({
      presence: "SYNARAVA_ONLY",
      localProductId: "local-7",
      allowedDirections: ["SYNARAVA_TO_SHOPIFY"],
    });
  });

  it("deduplicates products, counts only conflicts, and follows the locale registry including RU and future locales", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a", "b"],
      differences: [
        difference("a", "pt-PT", "title"),
        difference("a", "pt-PT", "title"),
        difference("a", "pt-PT", "description"),
        difference("a", "ru", "title"),
        difference("a", "de", "title"),
        difference("b", "en", "title"),
        difference("c", "ru", "title", "LOCAL_ONLY"),
        { ...difference("c", "ru", "title"), rootEntityType: "COLLECTION" },
      ],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      recentlyUpdatedProducts: [{ productId: "c", updatedAt: "2026-09-23T09:59:00.000Z" }],
      now: new Date("2026-09-23T10:01:00.000Z"),
    });

    expect(result.totalCount).toBe(2);
    expect(result.products["a"]).toMatchObject({
      shared: true,
      locales: [
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
        { code: "ru", nativeName: "Русский", count: 1 },
        { code: "de", nativeName: "Deutsch", count: 1 },
      ],
    });
    // Without explicit field counts, CONFLICT commerce rows fall back to sharedCount 1.
    expect(result.products["a"]?.sharedCount).toBe(1);
    expect(result.products["b"]?.locales).toMatchObject([{ code: "en", count: 1 }]);
    expect(result.products["c"]).toBeUndefined();
    expect(result.recentlyUpdatedProducts["c"]).toEqual({ updatedAt: "2026-09-23T09:59:00.000Z" });
    expect(result.state).toBe("ready");
  });

  it("includes collection presence differences when rootEntityType is COLLECTION", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["ignored-product"],
      differences: [
        { ...difference("col-1", "pt-PT", "title"), rootEntityType: "COLLECTION" },
        { ...difference("col-1", "ru", "description"), rootEntityType: "COLLECTION" },
        difference("product-1", "en", "title"),
      ],
      presenceDifferences: [{
        id: "shopify-collection:99",
        kind: "SHOPIFY_ONLY",
        localProductId: null,
        shopifyProductId: "gid://shopify/Collection/99",
        name: "Shopify kits",
        handle: "shopify-kits",
        sku: "",
        localFingerprint: "missing",
        shopifyFingerprint: "remote",
        remoteMissing: false,
        matchReason: "HANDLE",
        localIdentity: null,
        shopifyIdentity: { name: "Shopify kits", handle: "shopify-kits", sku: "" },
      }],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      now: new Date("2026-09-23T10:01:00.000Z"),
      rootEntityType: "COLLECTION",
    });

    expect(result.totalCount).toBe(2);
    expect(result.products["col-1"]).toMatchObject({
      shared: false,
      locales: [
        { code: "pt", count: 1 },
        { code: "ru", count: 1 },
      ],
    });
    expect(result.products["shopify-collection:99"]).toMatchObject({
      presence: "SHOPIFY_ONLY",
      name: "Shopify kits",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    });
    expect(result.products["ignored-product"]).toBeUndefined();
    expect(result.products["product-1"]).toBeUndefined();
  });

  it("allows deleting Synarava-only collections by choosing the Shopify side", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: [],
      differences: [],
      presenceDifferences: [{
        id: "local-7",
        kind: "SYNARAVA_ONLY",
        localProductId: "local-7",
        shopifyProductId: null,
        name: "Jewelry Making",
        handle: "jewelry-making",
        sku: "",
        localFingerprint: "local",
        shopifyFingerprint: "missing",
        remoteMissing: false,
        matchReason: null,
        localIdentity: { name: "Jewelry Making", handle: "jewelry-making", sku: "" },
        shopifyIdentity: null,
      }],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      now: new Date("2026-09-23T10:01:00.000Z"),
      rootEntityType: "COLLECTION",
    });

    expect(result.products["local-7"]).toMatchObject({
      presence: "SYNARAVA_ONLY",
      allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    });
  });

  it.each([
    [false, "SUCCEEDED", "disconnected"],
    [true, "RUNNING", "checking"],
    [true, "FAILED", "failed"],
    [true, "PARTIAL", "failed"],
    [true, "SUCCEEDED", "stale"],
  ] as const)("derives %s / %s as %s without hiding persisted conflicts", (connected, status, expected) => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a"], differences: [], locales,
      run: { trigger: "MANUAL", status, completedAt: "2026-09-20T10:00:00.000Z" },
      connected, now: new Date("2026-09-23T10:00:00.000Z"),
    });
    expect(result.state).toBe(expected);
    expect(result.totalCount).toBe(1);
  });

  it("does not mistake a recent single-locale check for a fresh catalog-wide check", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a"], differences: [], locales,
      run: { trigger: "LOCALE", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true, now: new Date("2026-09-23T10:01:00.000Z"),
    });
    expect(result.state).toBe("stale");
    expect(result.totalCount).toBe(1);
  });

  it("keeps the last successful full-check time visible while a newer scoped check is running or has failed", () => {
    for (const status of ["RUNNING", "FAILED"] as const) {
      const result = buildCatalogConflictSignals({
        commerceProductIds: ["a"], differences: [], locales,
        run: { trigger: "LOCALE", status, completedAt: null },
        lastSuccessfulFullCheckAt: "2026-09-23T09:55:00.000Z",
        connected: true, now: new Date("2026-09-23T10:00:00.000Z"),
      });
      expect(result.checkedAt).toBe("2026-09-23T09:55:00.000Z");
      expect(result.state).toBe(status === "RUNNING" ? "checking" : "failed");
    }
  });
});

describe("persistPayloadForCommerceInspection", () => {
  it("stores CONFLICT so the catalog list can reopen the same products after refresh", () => {
    expect(persistPayloadForCommerceInspection({
      state: "CONFLICT",
      differences: [{ field: "Vendor" }],
      remoteUpdatedAt: "2026-09-23T12:00:00.000Z",
    })).toEqual({ syncStatus: "CONFLICT" });
  });

  it("stores sharedCount from commerceFieldCounts for badge field totals", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["p1"],
      commerceFieldCounts: { p1: 2 },
      differences: [],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      now: new Date("2026-09-23T10:01:00.000Z"),
    });

    expect(result.products["p1"]).toMatchObject({ shared: true, sharedCount: 2 });
  });

  it("does not persist a CONFLICT with no remaining field differences", () => {
    expect(persistPayloadForCommerceInspection({
      state: "CONFLICT",
      differences: [],
      remoteUpdatedAt: "2026-09-23T12:00:00.000Z",
    })).toMatchObject({ syncStatus: "SYNCED" });
  });

  it("leaves one-sided commerce changes out of the conflict list", () => {
    expect(persistPayloadForCommerceInspection({
      state: "REMOTE_CHANGES",
      differences: [{ field: "Vendor" }],
      remoteUpdatedAt: null,
    })).toBeNull();
  });
});
