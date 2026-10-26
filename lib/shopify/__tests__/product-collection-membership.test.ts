/**
 * Product window membership = collection GID only.
 * Title/slug drift on a linked collection must not reappear on every member product.
 */
import { describe, expect, it } from "vitest";

import { mirrorProductCollections } from "@/lib/shopify/commerce-mirror-shape";
import { diffShopifyProjections } from "@/lib/shopify/shopify-projection-diff";
import { deriveCollectionWindow, deriveProductWindow } from "@/lib/sync/derive-window";
import { ourProductWindowFromRow } from "@/lib/sync/our-window-from-row";

describe("product collection membership — identity only", () => {
  it("same GID, different local title/slug → zero product membership diff", () => {
    const shopifySnapshot = {
      title: "Ring",
      handle: "ring",
      collections: mirrorProductCollections([
        { id: "gid://shopify/Collection/1", handle: "gold", title: "Gold (Shopify)" },
      ]),
    };
    const our = ourProductWindowFromRow({
      shopifyProductId: "gid://shopify/Product/1",
      name: "Ring",
      slug: "ring",
      status: "ACTIVE",
      collections: [{
        collection: {
          shopifyCollectionId: "gid://shopify/Collection/1",
          slug: "gold-local",
          name: "Gold (local rename)",
        },
      }],
      variants: [{
        sku: "SKU-1",
        title: "Default Title",
        priceCents: 1000,
        stockOnHand: 1,
        taxable: true,
      }],
    });

    const membershipDiffs = diffShopifyProjections(our, shopifySnapshot).filter(
      (d) => d.path === "collections" || d.path.startsWith("collections"),
    );
    expect(membershipDiffs).toEqual([]);
  });

  it("Collection entity still reports its own Name/Handle conflict", () => {
    const our = deriveCollectionWindow({
      shopifyCollectionId: "gid://shopify/Collection/1",
      name: "Gold (local)",
      slug: "gold-local",
    });
    const shopify = {
      id: "gid://shopify/Collection/1",
      title: "Gold (Shopify)",
      handle: "gold",
      descriptionHtml: "",
      seo: { title: null, description: null },
    };
    const diffs = diffShopifyProjections(our, shopify);
    expect(diffs.map((d) => d.field).toSorted()).toEqual(["Handle", "Name"]);
  });

  it("adding or removing a GID is one real product membership diff", () => {
    const base = {
      title: "Ring",
      handle: "ring",
      variants: [{ id: "v1", sku: "SKU-1", title: "Default", price: "10.00", taxable: true }],
    };
    const withOne = {
      ...base,
      collections: mirrorProductCollections([
        { id: "gid://shopify/Collection/1", handle: "gold", title: "Gold" },
      ]),
    };
    const withTwo = {
      ...base,
      collections: mirrorProductCollections([
        { id: "gid://shopify/Collection/1", handle: "gold", title: "Gold" },
        { id: "gid://shopify/Collection/2", handle: "silver", title: "Silver" },
      ]),
    };
    const diffs = diffShopifyProjections(withOne, withTwo).filter(
      (d) => d.path === "collections" || d.path.startsWith("collections"),
    );
    expect(diffs.length).toBeGreaterThanOrEqual(1);
    expect(diffs.every((d) => d.path.includes("collections"))).toBe(true);
  });

  it("omits frontpage / storefront-default and projects id only", () => {
    expect(mirrorProductCollections([
      { id: "gid://shopify/Collection/1", handle: "gold", title: "Gold" },
      { id: "gid://shopify/Collection/fp", handle: "frontpage", title: "Home" },
      { id: "gid://shopify/Collection/3", handle: "x", title: "X", isStorefrontDefault: true },
    ])).toEqual([{ id: "gid://shopify/Collection/1" }]);
  });

  it("deriveProductWindow membership is id-only", () => {
    const window = deriveProductWindow({
      name: "Ring",
      slug: "ring",
      status: "ACTIVE",
      collections: [
        { id: "gid://shopify/Collection/1", handle: "gold", title: "Gold" },
      ],
      variants: [{
        sku: "SKU-1",
        title: "Default",
        priceCents: 1000,
        stockOnHand: 0,
        taxable: true,
      }],
    }) as { collections?: unknown };
    expect(window.collections).toEqual([{ id: "gid://shopify/Collection/1" }]);
  });
});
