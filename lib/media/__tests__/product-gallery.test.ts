import { describe, expect, it } from "vitest";

import { combineProductGallery } from "../product-gallery";

describe("combineProductGallery", () => {
  it("keeps the primary image first and deduplicates local and Shopify media", () => {
    expect(combineProductGallery(
      { src: "https://cdn.example/main.webp", alt: "Main", width: 100, height: 120 },
      [
        { src: "https://cdn.example/detail.webp", alt: "Detail", width: 80, height: 80 },
        { src: "https://cdn.example/main.webp", alt: "Duplicate", width: 100, height: 120 },
      ],
      [
        { src: "https://cdn.example/shopify.webp", alt: "Shopify", width: null, height: null },
        { src: "https://cdn.example/detail.webp", alt: "Duplicate", width: 80, height: 80 },
      ],
    )).toEqual([
      { src: "https://cdn.example/main.webp", alt: "Main", width: 100, height: 120 },
      { src: "https://cdn.example/detail.webp", alt: "Detail", width: 80, height: 80 },
      { src: "https://cdn.example/shopify.webp", alt: "Shopify", width: null, height: null },
    ]);
  });
});
