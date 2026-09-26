import { describe, expect, it } from "vitest";

import {
  buildCollectionWindowFromColumns,
  collectionCommerceInputFromWindow,
  collectionWindowFromShopifyRemote,
  normalizeCollectionCommerceWindow,
  writeThroughLocalCollectionToProjection,
} from "@/lib/shopify/collection-commerce-projection";

describe("collection commerce projection", () => {
  it("builds a Shopify-shaped window from local columns", () => {
    const window = buildCollectionWindowFromColumns({
      shopifyCollectionId: "gid://shopify/Collection/1",
      name: "Rings",
      slug: "rings",
      description: "Fine rings",
      seoTitle: "Rings SEO",
      seoDescription: "All rings",
    });
    expect(window).toMatchObject({
      id: "gid://shopify/Collection/1",
      title: "Rings",
      handle: "rings",
      descriptionHtml: "<p>Fine rings</p>",
      seo: { title: "Rings SEO", description: "All rings" },
    });
  });

  it("preserves rich HTML when stripped text matches local description", () => {
    const base = collectionWindowFromShopifyRemote({
      id: "gid://shopify/Collection/1",
      title: "Rings",
      handle: "rings",
      descriptionHtml: "<p><strong>Fine rings</strong></p>",
      seo: { title: null, description: null },
    });
    const next = writeThroughLocalCollectionToProjection(base, {
      title: "Rings",
      handle: "rings",
      description: "Fine rings",
    });
    expect(next).toMatchObject({
      descriptionHtml: "<p><strong>Fine rings</strong></p>",
    });
  });

  it("replaces descriptionHtml when local text diverges", () => {
    const next = writeThroughLocalCollectionToProjection(
      { descriptionHtml: "<p>Old</p>" },
      { description: "New copy" },
    );
    expect(next).toMatchObject({ descriptionHtml: "<p>New copy</p>" });
  });

  it("reads push input from a window", () => {
    expect(collectionCommerceInputFromWindow({
      title: "Rings",
      handle: "rings",
      descriptionHtml: "<p>Hi</p>",
      seo: { title: "T", description: "D" },
    })).toEqual({
      title: "Rings",
      handle: "rings",
      descriptionHtml: "<p>Hi</p>",
      seo: { title: "T", description: "D" },
    });
  });

  it("normalizes before compare (strips updatedAt noise via canonicalize)", () => {
    const a = normalizeCollectionCommerceWindow({
      id: "gid://shopify/Collection/1",
      title: "Rings",
      handle: "rings",
      updatedAt: "2026-01-01",
    });
    const b = normalizeCollectionCommerceWindow({
      id: "gid://shopify/Collection/1",
      title: "Rings",
      handle: "rings",
      updatedAt: "2026-09-01",
    });
    expect(a).toEqual(b);
  });
});
