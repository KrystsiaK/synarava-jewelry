import { describe, expect, it } from "vitest";

import { assertNoAuthorEmail, toProductReviewsData } from "@/lib/reviews/map-public";
import { buildProductJsonLd } from "@/lib/seo/product-json-ld";
import type { ProductSummary } from "@/lib/content/catalog";

describe("toProductReviewsData", () => {
  it("exposes only PUBLISHED reviews and escapes HTML", () => {
    const data = toProductReviewsData([
      {
        id: "1",
        rating: 5,
        title: "<b>Nice</b>",
        body: "Great <script>",
        authorName: "Ana S.",
        status: "PUBLISHED",
        verifiedPurchase: false,
        createdAt: new Date("2026-11-15T12:00:00Z"),
      },
      {
        id: "2",
        rating: 1,
        title: "Hidden",
        body: "nope",
        authorName: "Bob",
        status: "PENDING",
        verifiedPurchase: false,
        createdAt: new Date("2026-11-15T12:00:00Z"),
      },
    ]);
    expect(data.count).toBe(1);
    expect(data.reviews).toHaveLength(1);
    expect(data.reviews[0]?.title).toContain("&lt;");
    expect(JSON.stringify(data)).not.toMatch(/authorEmail/i);
  });
});

describe("JSON-LD email guard", () => {
  it("never includes authorEmail and omits PENDING-only aggregates", () => {
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

    const empty = buildProductJsonLd(product, "https://synarava.com", {
      average: null,
      count: 0,
      reviews: [],
    });
    expect(empty).not.toHaveProperty("aggregateRating");
    expect(empty).not.toHaveProperty("review");

    const withPublished = buildProductJsonLd(product, "https://synarava.com", {
      average: 5,
      count: 1,
      reviews: [
        {
          id: "r1",
          rating: 5,
          title: "Beautiful",
          body: "Better in person.",
          authorDisplayName: "Ana S.",
          submittedAt: "2026-09-10T12:00:00Z",
          verificationStatus: "unverified",
          merchantReply: "",
          merchantRepliedAt: null,
        },
      ],
    });
    expect(withPublished.aggregateRating).toMatchObject({ ratingValue: 5, reviewCount: 1 });
    expect(JSON.stringify(withPublished)).not.toMatch(/authorEmail/i);
    expect(() =>
      assertNoAuthorEmail({ authorEmail: "secret@example.com" }),
    ).toThrow(/authorEmail/);
  });
});
