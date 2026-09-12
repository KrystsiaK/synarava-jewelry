import { describe, expect, it } from "vitest";

import {
  matchReadyShopifyMedia,
  SHOPIFY_PRODUCT_MEDIA_FRAGMENT,
  shopifyMediaFilename,
} from "@/lib/shopify/staged-product-media";

describe("shopifyMediaFilename", () => {
  it("uses only fields supported by Shopify MediaImage in the product query", () => {
    expect(SHOPIFY_PRODUCT_MEDIA_FRAGMENT).toContain("originalSource { url }");
    expect(SHOPIFY_PRODUCT_MEDIA_FRAGMENT).not.toMatch(/\bfilename\b/);
  });

  it("derives the uploaded filename from Shopify's supported originalSource URL", () => {
    expect(shopifyMediaFilename({
      originalSourceUrl: "https://cdn.shopify.com/s/files/1/0001/files/front-uuid.webp?v=123",
      imageUrl: "https://cdn.shopify.com/s/files/1/0001/products/front_2048x.webp?v=123",
    })).toBe("front-uuid.webp");
  });

  it("falls back to the processed image URL and decodes escaped filenames", () => {
    expect(shopifyMediaFilename({
      originalSourceUrl: null,
      imageUrl: "https://cdn.shopify.com/s/files/1/0001/files/detail%20view.webp?v=123",
    })).toBe("detail view.webp");
  });

  it("returns null for missing or malformed URLs", () => {
    expect(shopifyMediaFilename({ originalSourceUrl: null, imageUrl: null })).toBeNull();
    expect(shopifyMediaFilename({ originalSourceUrl: "not a url", imageUrl: null })).toBeNull();
  });
});

describe("matchReadyShopifyMedia", () => {
  const staged = [
    { assetId: "asset-1", filename: "front-uuid.webp", key: "uploads/products/front-uuid.webp" },
    { assetId: "asset-2", filename: "detail-uuid.webp", key: "uploads/products/detail-uuid.webp" },
  ];

  it("returns Shopify CDN replacements only when every staged image is ready", () => {
    expect(matchReadyShopifyMedia(staged, [
      { id: "gid://shopify/MediaImage/1", filename: "front-uuid.webp", status: "READY", imageUrl: "https://cdn.shopify.com/front.webp" },
      { id: "gid://shopify/MediaImage/2", filename: "detail-uuid.webp", status: "READY", imageUrl: "https://cdn.shopify.com/detail.webp" },
    ])).toEqual([
      { ...staged[0], shopifyMediaId: "gid://shopify/MediaImage/1", shopifyUrl: "https://cdn.shopify.com/front.webp" },
      { ...staged[1], shopifyMediaId: "gid://shopify/MediaImage/2", shopifyUrl: "https://cdn.shopify.com/detail.webp" },
    ]);
  });

  it("refuses cleanup while even one Shopify image is still processing", () => {
    expect(matchReadyShopifyMedia(staged, [
      { id: "gid://shopify/MediaImage/1", filename: "front-uuid.webp", status: "READY", imageUrl: "https://cdn.shopify.com/front.webp" },
      { id: "gid://shopify/MediaImage/2", filename: "detail-uuid.webp", status: "PROCESSING", imageUrl: null },
    ])).toBeNull();
  });

  it("matches by the unique staged filename rather than response order", () => {
    const matched = matchReadyShopifyMedia(staged, [
      { id: "gid://shopify/MediaImage/2", filename: "detail-uuid.webp", status: "READY", imageUrl: "https://cdn.shopify.com/detail.webp" },
      { id: "gid://shopify/MediaImage/1", filename: "front-uuid.webp", status: "READY", imageUrl: "https://cdn.shopify.com/front.webp" },
    ]);
    expect(matched?.map((item) => item.assetId)).toEqual(["asset-1", "asset-2"]);
  });
});
