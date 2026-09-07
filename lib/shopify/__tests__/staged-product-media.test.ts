import { describe, expect, it } from "vitest";

import { matchReadyShopifyMedia } from "@/lib/shopify/staged-product-media";

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
