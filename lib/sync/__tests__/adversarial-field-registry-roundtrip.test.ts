/**
 * Phase 1 — every field-registry commerce path round-trips through
 * canonicalize → compare with zero diffs when both sides match.
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { describe, expect, it } from "vitest";

import { canonicalizeShopifyProjection, diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { compareSyncState } from "@/lib/sync/compare";
import {
  COLLECTION_COMMERCE_FIELDS,
  PRODUCT_COMMERCE_FIELDS,
  lookupContractForPath,
  type SyncFieldDef,
} from "@/lib/sync/field-registry";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
] as const;

/** Minimal Shopify-shaped product covering registry paths used in windows. */
function baseProductWindow(): Record<string, unknown> {
  return {
    title: "Ring",
    handle: "ring",
    descriptionHtml: "<p>Hello</p>",
    vendor: "Synarava",
    productType: "Ring",
    status: "ACTIVE",
    tags: ["gold"],
    seo: { title: "SEO", description: "Desc" },
    category: { id: "gid://shopify/TaxonomyCategory/1", name: "Rings", fullName: "Rings" },
    options: [{ id: "gid://shopify/ProductOption/1", name: "Title", position: 1, values: ["Default Title"] }],
    variants: [{
      id: "gid://shopify/ProductVariant/1",
      title: "Default Title",
      sku: "SKU-1",
      barcode: null,
      price: "10.00",
      compareAtPrice: null,
      inventoryPolicy: "DENY",
      inventoryQuantity: 1,
      taxable: true,
      selectedOptions: [{ name: "Title", value: "Default Title" }],
      inventoryItem: {
        id: "gid://shopify/InventoryItem/1",
        requiresShipping: true,
        tracked: true,
        countryCodeOfOrigin: null,
        harmonizedSystemCode: null,
        unitCost: { amount: "4.00", currencyCode: "EUR" },
        measurement: { weight: { value: 1, unit: "GRAMS" } },
      },
    }],
    media: [{
      id: "gid://shopify/MediaImage/1",
      alt: "Front",
      preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
    }],
    metafields: [],
    collections: [{ id: "gid://shopify/Collection/1", handle: "all", title: "All" }],
  };
}

function baseCollectionWindow(): Record<string, unknown> {
  return {
    title: "All",
    handle: "all",
    descriptionHtml: "<p>All</p>",
    sortOrder: "MANUAL",
    seo: { title: null, description: null },
    image: null,
  };
}

function fieldsWithWindowPaths(fields: readonly SyncFieldDef[]): SyncFieldDef[] {
  return fields.filter((field) => field.windowPaths.length > 0);
}

describe("adversarial: field-registry equal windows → zero diffs", () => {
  it("every PRODUCT_COMMERCE_FIELDS path resolves via lookupContractForPath", () => {
    for (const field of fieldsWithWindowPaths(PRODUCT_COMMERCE_FIELDS)) {
      for (const pattern of field.windowPaths) {
        const concrete = pattern
          .replace("variants[]", "variants[0]")
          .replace("media[]", "media[0]")
          .replace("metafields[]", "metafields[0]")
          .replace("collections[]", "collections[0]")
          .replace("options[]", "options[0]");
        const found = lookupContractForPath(concrete);
        expect(found?.contractKey, `${field.contractKey} ← ${concrete}`).toBe(field.contractKey);
      }
    }
  });

  it("identical product windows after canonicalize produce zero commerce leaves", () => {
    const raw = baseProductWindow();
    const our = canonicalizeShopifyProjection(raw);
    const shopify = canonicalizeShopifyProjection(structuredClone(raw));
    expect(diffShopifyProjections(our, shopify)).toEqual([]);
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: our,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-28T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-28T12:01:00.000Z"),
    });
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toEqual([]);
  });

  it("identical collection windows after canonicalize produce zero commerce leaves", () => {
    const raw = baseCollectionWindow();
    const our = canonicalizeShopifyProjection(raw);
    const shopify = canonicalizeShopifyProjection(structuredClone(raw));
    expect(diffShopifyProjections(our, shopify)).toEqual([]);
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c1",
        ourWindow: our,
        shopifySnapshot: shopify,
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-28T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-28T12:01:00.000Z"),
    });
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toEqual([]);
  });

  /**
   * SYNC-ADV-002 — `lookupContractForPath` searches PRODUCT registry first.
   * Shared paths (`title`, `handle`, …) resolve to product contractKeys even
   * when the caller is labeling a collection window.
   * @see docs/audits/2026-10-28-sync-adversarial.md#SYNC-ADV-002
   */
  it.fails("collection window paths resolve to COLLECTION contractKeys (SYNC-ADV-002)", () => {
    expect(fieldsWithWindowPaths(COLLECTION_COMMERCE_FIELDS).length).toBeGreaterThan(0);
    for (const field of fieldsWithWindowPaths(COLLECTION_COMMERCE_FIELDS)) {
      for (const pattern of field.windowPaths) {
        expect(lookupContractForPath(pattern)?.contractKey, field.contractKey).toBe(field.contractKey);
      }
    }
  });
});
