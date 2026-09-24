import { describe, expect, it } from "vitest";

import { resolveFinalCtaImages } from "@/lib/content/home-final-cta-section";

describe("resolveFinalCtaImages", () => {
  const products = [
    { id: "a", image: "/a.webp" },
    { id: "b", image: "/b.webp" },
    { id: "c", image: "/c.webp" },
    { id: "d", image: "/d.webp" },
    { id: "e", image: "" },
  ];
  const fallback = [{ image: "/fallback.webp" }];

  it("pads four slots from selected products", () => {
    expect(resolveFinalCtaImages(products, ["a", "b", "c", "d"], fallback)).toEqual([
      { image: "/a.webp" },
      { image: "/b.webp" },
      { image: "/c.webp" },
      { image: "/d.webp" },
    ]);
  });

  it("cycles fewer selected products across four slots", () => {
    expect(resolveFinalCtaImages(products, ["a", "b"], fallback)).toEqual([
      { image: "/a.webp" },
      { image: "/b.webp" },
      { image: "/a.webp" },
      { image: "/b.webp" },
    ]);
  });

  it("falls back to featured-collection media when no products are chosen", () => {
    expect(resolveFinalCtaImages(products, [], fallback)).toEqual([
      { image: "/fallback.webp" },
      { image: "/fallback.webp" },
      { image: "/fallback.webp" },
      { image: "/fallback.webp" },
    ]);
  });

  it("skips products without images", () => {
    expect(resolveFinalCtaImages(products, ["e", "a"], fallback)).toEqual([
      { image: "/a.webp" },
      { image: "/a.webp" },
      { image: "/a.webp" },
      { image: "/a.webp" },
    ]);
  });
});
