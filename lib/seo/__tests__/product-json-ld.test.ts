import { describe, expect, it } from "vitest";

import type { ProductSummary } from "@/lib/content/catalog";
import { buildProductJsonLd } from "../product-json-ld";

describe("buildProductJsonLd", () => {
  it("builds localized product URLs", () => {
    const product = {
      slug: "silver-ring",
      sku: "RING-01",
      title: "Silver Ring",
      shortDescription: "A handmade silver ring.",
      description: "",
      image: "",
      commerceMedia: [],
      vendor: "Synarava",
      categoryName: "Rings",
      priceAmount: 129.5,
      currency: "EUR",
      stockOnHand: 2,
      inStock: true,
    } as ProductSummary;
    const data = buildProductJsonLd(product, "https://synarava.com", null, "pt");
    expect(data.url).toBe("https://synarava.com/pt/products/silver-ring");
    expect(data.offers.url).toBe(data.url);
  });

  it("adds published review aggregate and omits authorEmail", () => {
    const product = {
      slug: "silver-ring",
      sku: "RING-01",
      title: "Silver Ring",
      shortDescription: "A handmade silver ring.",
      description: "",
      image: "",
      commerceMedia: [],
      vendor: "Synarava",
      categoryName: "Rings",
      priceAmount: 129.5,
      currency: "EUR",
      stockOnHand: 2,
      inStock: true,
    } as ProductSummary;

    const jsonLd = buildProductJsonLd(product, "https://synarava.com", {
      average: 4.5,
      count: 2,
      reviews: [
        {
          id: "review-1",
          rating: 5,
          title: "Beautiful",
          body: "Better in person.",
          authorDisplayName: "Ana",
          submittedAt: "2026-09-10T12:00:00Z",
          verificationStatus: "verified_buyer",
          merchantReply: "",
          merchantRepliedAt: null,
        },
      ],
    });
    expect(jsonLd.aggregateRating).toMatchObject({
      ratingValue: 4.5,
      reviewCount: 2,
    });
    expect(jsonLd.review).toHaveLength(1);
    expect(JSON.stringify(jsonLd)).not.toMatch(/authorEmail/i);
  });

  it("reports OutOfStock for a product with no purchasable variant, even with stale stockOnHand", () => {
    const product = {
      slug: "silver-ring",
      sku: "RING-01",
      title: "Silver Ring",
      shortDescription: "",
      description: "",
      image: "",
      commerceMedia: [],
      vendor: "Synarava",
      priceAmount: 10,
      currency: "EUR",
      stockOnHand: 5,
      inStock: false,
    } as ProductSummary;
    const jsonLd = buildProductJsonLd(product, "https://synarava.com");
    expect(jsonLd.offers.availability).toBe("https://schema.org/OutOfStock");
  });
});
