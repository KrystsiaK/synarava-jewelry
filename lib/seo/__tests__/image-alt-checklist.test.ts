import { describe, expect, it } from "vitest";

import {
  countWeakGalleryAlts,
  imageAltCoverageTone,
  imageAltNeedsAttention,
  imageAltSoftWarning,
  isFilenameLikeImageAlt,
  isPlaceholderImageAlt,
  productGalleryAltsForChecklist,
} from "../image-alt-checklist";

describe("image alt checklist", () => {
  it("flags blank, placeholder, and filename-like alts", () => {
    expect(imageAltNeedsAttention("")).toBe(true);
    expect(imageAltNeedsAttention("Image 1")).toBe(true);
    expect(isPlaceholderImageAlt("Image 3")).toBe(true);
    expect(isFilenameLikeImageAlt("dsc-6301", "dsc-6301.webp")).toBe(true);
    expect(isFilenameLikeImageAlt("lava-ring-1b5f1e41")).toBe(true);
    expect(imageAltNeedsAttention("Lava ring on linen, side view")).toBe(false);
    expect(imageAltSoftWarning("photo.jpg")).toMatch(/filename/i);
  });

  it("reads local ProductMedia before workingSnapshot frames", () => {
    expect(
      productGalleryAltsForChecklist({
        media: [{ alt: "Cover", asset: { filename: "cover.webp" } }],
        workingSnapshot: {
          media: [{ id: "gid://shopify/MediaImage/1", alt: "Tree", preview: { image: { url: "/a.webp" } } }],
        },
      }),
    ).toEqual([{ alt: "Cover", filename: "cover.webp" }]);

    expect(
      productGalleryAltsForChecklist({
        media: [],
        workingSnapshot: {
          media: [{ id: "gid://shopify/MediaImage/1", alt: "Image 1", preview: { image: { url: "/a.webp" } } }],
        },
      }),
    ).toEqual([{ alt: "Image 1", filename: null }]);
  });

  it("counts weak alts and maps coverage tones", () => {
    expect(
      countWeakGalleryAlts([
        { alt: "Good description here" },
        { alt: "Image 2" },
        { alt: "dsc-1", filename: "dsc-1.jpg" },
      ]),
    ).toBe(2);
    expect(imageAltCoverageTone({ publishedWithMedia: 0, withGoodAlt: 0 })).toBe("empty");
    expect(imageAltCoverageTone({ publishedWithMedia: 2, withGoodAlt: 0 })).toBe("warn");
    expect(imageAltCoverageTone({ publishedWithMedia: 2, withGoodAlt: 1 })).toBe("partial");
    expect(imageAltCoverageTone({ publishedWithMedia: 2, withGoodAlt: 2 })).toBe("ok");
  });
});
