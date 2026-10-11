import { describe, expect, it } from "vitest";

import {
  buildStorefrontProductGallery,
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

describe("buildStorefrontProductGallery", () => {
  const mediaTree = [
    {
      id: "gid://shopify/MediaImage/2",
      src: "https://cdn.shopify.com/s/files/1/1101/files/horseshoe-a.jpg?v=1",
      alt: "A",
      width: 1600,
      height: 2000,
    },
    {
      id: "gid://shopify/MediaImage/3",
      src: "https://cdn.shopify.com/s/files/1/1101/files/horseshoe-b.jpg?v=1",
      alt: "B",
      width: 1600,
      height: 2000,
    },
    {
      id: "gid://shopify/MediaImage/4",
      src: "https://cdn.shopify.com/s/files/1/1101/files/horseshoe-c.jpg?v=1",
      alt: "C",
      width: 1600,
      height: 2000,
    },
    {
      id: "gid://shopify/MediaImage/1",
      src: "https://cdn.shopify.com/s/files/1/1101/files/horseshoe-cover.jpg?v=99",
      alt: "Cover in tree",
      width: 1600,
      height: 2000,
    },
  ];

  it("uses OUR media tree order only when featured is also in the array (no prepend)", () => {
    // Featured/cover as a separate Product.imageUrl field must not invent a 5th thumb
    // when the same frame already lives last in workingSnapshot.media / ProductMedia.
    const result = buildStorefrontProductGallery({
      media: mediaTree,
      featuredFallback: {
        src: "https://cdn.shopify.com/s/files/1/1101/files/horseshoe-cover.jpg?v=1",
        alt: "Featured",
        width: null,
        height: null,
      },
    });
    expect(result).toHaveLength(4);
    expect(result.map((frame) => frame.src)).toEqual(mediaTree.map((frame) => frame.src));
  });

  it("does not invent a ghost when featured URL cannot dedupe against the tree (S3 vs CDN)", () => {
    const result = buildStorefrontProductGallery({
      media: mediaTree,
      featuredFallback: {
        src: "https://media.synarava.example/products/horseshoe-cover.jpg",
        alt: "Featured",
        width: null,
        height: null,
      },
    });
    expect(result).toHaveLength(4);
    expect(result[0]?.src).toBe(mediaTree[0]?.src);
    expect(result.at(-1)?.src).toBe(mediaTree.at(-1)?.src);
  });

  it("falls back to featured only when the media tree is empty", () => {
    expect(buildStorefrontProductGallery({
      media: [],
      featuredFallback: {
        src: "https://cdn.shopify.com/s/files/1/1101/files/solo.jpg",
        alt: "Solo",
        width: null,
        height: null,
      },
    })).toEqual([{
      src: "https://cdn.shopify.com/s/files/1/1101/files/solo.jpg",
      alt: "Solo",
      width: null,
      height: null,
    }]);
  });

  it("dedupes duplicate frames inside the media tree itself", () => {
    expect(buildStorefrontProductGallery({
      media: [
        mediaTree[0]!,
        mediaTree[0]!,
        mediaTree[1]!,
      ],
      featuredFallback: null,
    })).toHaveLength(2);
  });
});
