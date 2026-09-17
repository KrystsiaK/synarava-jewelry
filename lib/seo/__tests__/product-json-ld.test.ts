import { describe, expect, it } from "vitest";

import type { ProductSummary } from "@/lib/content/catalog";
import { buildProductJsonLd } from "../product-json-ld";

describe("product JSON-LD", () => {
  it("uses canonical numeric commerce data and availability", () => {
    const product = {
      slug: "silver-ring",
      sku: "RING-01",
      title: "Silver Ring",
      shortDescription: "A handmade silver ring.",
      description: "",
      image: "https://cdn.example.com/ring.jpg",
      commerceMedia: [],
      vendor: "Synarava",
      categoryName: "Rings",
      priceAmount: 129.5,
      currency: "EUR",
      stockOnHand: 2,
      inStock: true,
    } as ProductSummary;

    expect(buildProductJsonLd(product, "https://synarava.com/")).toMatchObject({
      "@type": "Product",
      "@id": "https://synarava.com/en/products/silver-ring#product",
      sku: "RING-01",
      image: ["https://cdn.example.com/ring.jpg"],
      offers: {
        price: "129.50",
        priceCurrency: "EUR",
        availability: "https://schema.org/InStock",
      },
    });
  });

  it("uses the Portuguese canonical URL for product and offer structured data", () => {
    const product = {
      slug: "silver-ring",
      title: "Anel de prata",
      image: "",
      commerceMedia: [],
      priceAmount: 129.5,
      currency: "EUR",
      inStock: true,
    } as ProductSummary;
    const data = buildProductJsonLd(product, "https://synarava.com", null, "pt");
    expect(data.url).toBe("https://synarava.com/pt/products/silver-ring");
    expect(data.offers.url).toBe(data.url);
  });

  it("adds Shopify review aggregate and published reviews when available", () => {
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

    expect(buildProductJsonLd(product, "https://synarava.com", {
      average: 4.5,
      count: 2,
      reviews: [{
        id: "review-1",
        handle: "review-1",
        rating: 5,
        title: "Beautiful",
        body: "Better in person.",
        authorDisplayName: "Ana",
        submittedAt: "2026-09-10T12:00:00Z",
        verificationStatus: "verified_buyer",
        merchantReply: "",
        merchantRepliedAt: null,
      }],
    })).toMatchObject({
      aggregateRating: { "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 2 },
      review: [{
        "@type": "Review",
        name: "Beautiful",
        reviewRating: { "@type": "Rating", ratingValue: 5, bestRating: 5, worstRating: 1 },
        author: { "@type": "Person", name: "Ana" },
      }],
    });
  });

  it("reports OutOfStock for a product with no purchasable variant, even with stale stockOnHand", () => {
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
      inStock: false,
    } as ProductSummary;

    expect(buildProductJsonLd(product, "https://synarava.com")).toMatchObject({
      offers: { availability: "https://schema.org/OutOfStock" },
    });
  });
});
