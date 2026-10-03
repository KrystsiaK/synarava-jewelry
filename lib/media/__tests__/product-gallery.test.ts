import { describe, expect, it } from "vitest";

import {
  combineProductGallery,
  normalizeGallerySrc,
  productGalleryDedupeKey,
} from "../product-gallery";

describe("normalizeGallerySrc", () => {
  it("strips Shopify CDN query params and size suffixes", () => {
    expect(normalizeGallerySrc(
      "https://cdn.shopify.com/s/files/1/0001/files/cover.jpg?v=99",
    )).toBe("https://cdn.shopify.com/s/files/1/0001/files/cover.jpg");
    expect(normalizeGallerySrc(
      "https://cdn.shopify.com/s/files/1/0001/products/cover_2048x.jpg?v=1",
    )).toBe("https://cdn.shopify.com/s/files/1/0001/products/cover.jpg");
  });
});

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

  it("dedupes featured cover against gallery when Shopify CDN URLs only differ by ?v=", () => {
    expect(combineProductGallery(
      {
        src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-cover.jpg?v=1",
        alt: "Cover",
        width: null,
        height: null,
      },
      [],
      [
        {
          id: "gid://shopify/MediaImage/1",
          src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-cover.jpg?v=99",
          alt: "Pearl Necklace · 4 mm",
          width: 1600,
          height: 2000,
        },
        {
          id: "gid://shopify/MediaImage/2",
          src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-flat.jpg?v=99",
          alt: "Pearl Necklace · 4 mm",
          width: 1600,
          height: 2000,
        },
        {
          id: "gid://shopify/MediaImage/3",
          src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-worn.jpg?v=99",
          alt: "Pearl Necklace · 4 mm",
          width: 1600,
          height: 2000,
        },
      ],
    )).toEqual([
      {
        src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-cover.jpg?v=1",
        alt: "Cover",
        width: null,
        height: null,
      },
      {
        src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-flat.jpg?v=99",
        alt: "Pearl Necklace · 4 mm",
        width: 1600,
        height: 2000,
      },
      {
        src: "https://cdn.shopify.com/s/files/1/1101/files/pearl-worn.jpg?v=99",
        alt: "Pearl Necklace · 4 mm",
        width: 1600,
        height: 2000,
      },
    ]);
  });

  it("dedupes by media id when the same frame is projected twice with different URLs", () => {
    expect(combineProductGallery(
      null,
      [{
        id: "gid://shopify/MediaImage/1",
        src: "https://cdn.shopify.com/s/files/1/1101/files/cover_1024x.jpg?v=1",
        alt: "A",
        width: 1024,
        height: 1024,
      }],
      [{
        id: "gid://shopify/MediaImage/1",
        src: "https://cdn.shopify.com/s/files/1/1101/files/cover.jpg?v=2",
        alt: "B",
        width: 2048,
        height: 2048,
      }],
    )).toEqual([{
      src: "https://cdn.shopify.com/s/files/1/1101/files/cover_1024x.jpg?v=1",
      alt: "A",
      width: 1024,
      height: 1024,
    }]);
    expect(productGalleryDedupeKey({
      id: "gid://shopify/MediaImage/1",
      src: "https://cdn.shopify.com/a.jpg",
    })).toBe("id:gid://shopify/MediaImage/1");
  });
});
