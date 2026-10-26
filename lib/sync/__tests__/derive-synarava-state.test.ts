import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { deriveCollectionWindow, deriveProductWindow } from "@/lib/sync/derive-window";
import {
  PRODUCT_COMMERCE_FIELDS,
  isScopedProductCommerceLabel,
  labelForWindowPath,
} from "@/lib/sync/field-registry";
import { assertCountInvariant, slice } from "@/lib/sync/select";
import { collectionWindowFromShopifyRemote } from "@/lib/shopify/collection-commerce-projection";
import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";

const EN_LOCALE = {
  code: "en",
  shopifyLocale: "en",
  name: "English",
  nativeName: "English",
  isDefault: true,
  sortOrder: 0,
} as const;

const PT_LOCALE = {
  code: "pt",
  shopifyLocale: "pt-PT",
  name: "Portuguese",
  nativeName: "Português",
  isDefault: false,
  sortOrder: 1,
} as const;

function productColumns(overrides: Partial<Parameters<typeof deriveProductWindow>[0]> = {}) {
  return {
    shopifyProductId: "gid://shopify/Product/1",
    name: "Ring",
    slug: "ring",
    vendor: "Synarava",
    productType: "Ring",
    status: "ACTIVE",
    variants: [{
      sku: "SKU-1",
      title: "Default Title",
      priceCents: 12000,
      stockOnHand: 2,
      taxable: true,
    }],
    ...overrides,
  };
}

describe("derive-synarava-state (ADR-0009)", () => {
  it("image only in Synarava extras.media conflicts vs empty/missing shopify media (derive, no prior save)", () => {
    const ourWindow = deriveProductWindow(productColumns({
      extras: {
        media: [{
          id: "gid://shopify/MediaImage/1",
          alt: "Front",
          preview: { image: { url: "https://cdn.shopify.com/a.webp" } },
        }],
      },
    }));
    const shopifySnapshot = deriveProductWindow(productColumns({
      extras: { media: [] },
    }));
    // Drop media so Shopify side is empty after canonicalize.
    const shopifyEmptyMedia = { ...(shopifySnapshot as object), media: [] };

    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow,
        shopifySnapshot: shopifyEmptyMedia,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [EN_LOCALE],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    const mediaLeaves = result.leaves.filter(
      (leaf) => leaf.kind === "commerce" && (leaf.label === "Media gallery" || leaf.path?.startsWith("media")),
    );
    expect(mediaLeaves.length).toBeGreaterThan(0);
    expect(mediaLeaves.every((leaf) => leaf.node === "base")).toBe(true);
  });

  it("synaravaOnly fields (passport / note) never appear as commerce conflict leaves", () => {
    const ourWindow = deriveProductWindow(productColumns({
      extras: {
        // passport/note are Synarava columns — not in the commerce window even if
        // someone stuffed them into extras by mistake.
        passport: "secret",
        note: "internal",
      } as Record<string, unknown>,
    }));
    const shopifySnapshot = deriveProductWindow(productColumns());

    const diffs = diffShopifyProjections(ourWindow, shopifySnapshot);
    expect(diffs.some((d) => /passport|note/i.test(d.path) || /passport|note/i.test(d.field))).toBe(false);

    for (const field of PRODUCT_COMMERCE_FIELDS.filter((f) => f.scope === "synaravaOnly")) {
      expect(field.windowPaths).toEqual([]);
      expect(diffs.some((d) => d.field === field.label)).toBe(false);
    }
  });

  it("product and collection use the same derive + deepDiff compare approach", () => {
    const productOur = deriveProductWindow(productColumns({ name: "Local" }));
    const productShopify = deriveProductWindow(productColumns({ name: "Remote" }));
    const productDiffs = diffShopifyProjections(productOur, productShopify);
    expect(productDiffs.some((d) => d.path === "title")).toBe(true);

    const collectionOur = deriveCollectionWindow({
      shopifyCollectionId: "gid://shopify/Collection/1",
      name: "Local kits",
      slug: "local-kits",
      description: "Desc",
      seoTitle: null,
      seoDescription: null,
    });
    const collectionShopify = collectionWindowFromShopifyRemote({
      id: "gid://shopify/Collection/1",
      title: "Remote kits",
      handle: "local-kits",
      descriptionHtml: "<p>Desc</p>",
      seo: { title: null, description: null },
    });
    const collectionDiffs = diffShopifyProjections(collectionOur, collectionShopify);
    expect(collectionDiffs.some((d) => d.path === "title")).toBe(true);

    const productResult = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: productOur,
        shopifySnapshot: productShopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [EN_LOCALE],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });
    const collectionResult = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c1",
        ourWindow: collectionOur,
        shopifySnapshot: collectionShopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [EN_LOCALE],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });
    expect(productResult.leaves.every((l) => l.kind === "commerce" && l.node === "base")).toBe(true);
    expect(collectionResult.leaves.every((l) => l.kind === "commerce" && l.node === "base")).toBe(true);
    expect(productResult.leaves.some((l) => l.label === "Name")).toBe(true);
    expect(collectionResult.leaves.some((l) => l.label === "Name")).toBe(true);
  });

  it("fake registry field: windowPaths appear via labelForWindowPath + scoped apply flag", () => {
    // Document: adding to PRODUCT_COMMERCE_FIELDS with windowPaths surfaces via
    // deepDiff path labeling (labelForWindowPath / labelForShopifyProjectionPath).
    const media = PRODUCT_COMMERCE_FIELDS.find((f) => f.key === "media");
    expect(media).toBeDefined();
    expect(media!.windowPaths).toContain("media");
    expect(labelForWindowPath("media")).toBe("Media gallery");
    expect(labelForWindowPath("media[0].alt")).toBe("Media gallery");
    expect(isScopedProductCommerceLabel("Media gallery")).toBe(true);

    const passport = PRODUCT_COMMERCE_FIELDS.find((f) => f.key === "passport");
    expect(passport!.scope).toBe("synaravaOnly");
    expect(passport!.windowPaths).toEqual([]);
    expect(isScopedProductCommerceLabel("Synarava Passport")).toBe(false);
  });

  it("apply-shaped compare: identical derive windows → zero diffs; mutate one column → one leaf", () => {
    const left = deriveProductWindow(productColumns({ vendor: "Synarava" }));
    const right = deriveProductWindow(productColumns({ vendor: "Synarava" }));
    expect(diffShopifyProjections(left, right)).toEqual([]);

    const mutated = deriveProductWindow(productColumns({ vendor: "Other" }));
    const diffs = diffShopifyProjections(left, mutated);
    expect(diffs).toHaveLength(1);
    expect(diffs[0]).toMatchObject({ path: "vendor", field: "Vendor" });

    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: left,
        shopifySnapshot: mutated,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [EN_LOCALE],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });
    expect(result.leaves).toHaveLength(1);
    expect(result.leaves[0].label).toBe("Vendor");
  });

  it("select slice invariant: count(entity)==count(base)+sum(count(locale))", () => {
    const ourWindow = deriveProductWindow(productColumns({ vendor: "Us" }));
    const shopifySnapshot = deriveProductWindow(productColumns({ vendor: "Them" }));
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow,
        shopifySnapshot,
      }],
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
      locales: [EN_LOCALE, PT_LOCALE],
      connected: true,
      checkedAt: "2026-10-23T10:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-23T10:01:00.000Z"),
    });

    expect(slice(result, { entityId: "p1", node: "base" }).length).toBeGreaterThan(0);
    expect(() => assertCountInvariant(result, "p1", ["pt"])).not.toThrow();
    const entity = slice(result, { entityId: "p1" }).length;
    const base = slice(result, { entityId: "p1", node: "base" }).length;
    const locale = slice(result, { entityId: "p1", node: "pt" }).length;
    expect(entity).toBe(base + locale);
  });
});
