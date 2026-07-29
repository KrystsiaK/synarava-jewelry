import { describe, expect, it } from "vitest";

import { buildFinalCtaImages } from "@/lib/content/home-media";

describe("buildFinalCtaImages", () => {
  it("returns no image slots when CMS collections have no images", () => {
    expect(buildFinalCtaImages([])).toEqual([]);
    expect(buildFinalCtaImages([{ image: "" }, { image: null }])).toEqual([]);
  });

  it("safely repeats one CMS image across the four desktop slots", () => {
    const collection = { image: "/media/uploads/collections/axis.webp" };

    expect(buildFinalCtaImages([collection])).toEqual([
      collection,
      collection,
      collection,
      collection,
    ]);
  });

  it("uses only collections that have CMS images", () => {
    const first = { image: "/media/uploads/collections/first.webp" };
    const second = { image: "/media/uploads/collections/second.webp" };

    expect(buildFinalCtaImages([first, { image: "" }, second])).toEqual([
      first,
      second,
      first,
      second,
    ]);
  });
});
