import { describe, expect, it } from "vitest";

import { assertNoAuthorEmail, toProductReviewsData } from "@/lib/reviews/map-public";
import { buildProductJsonLd } from "@/lib/seo/product-json-ld";
import { safeJsonLd } from "@/lib/seo/json-ld";
import type { ProductSummary } from "@/lib/content/catalog";

const RAW_TITLE = `Rock & "Roll" <b>`;
const RAW_BODY = `Great <script> & more`;

describe("toProductReviewsData", () => {
  it("keeps review text literal (no HTML entity escaping) for React / JSON-LD", () => {
    const data = toProductReviewsData([
      {
        id: "1",
        rating: 5,
        title: RAW_TITLE,
        body: RAW_BODY,
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
    expect(data.reviews[0]?.title).toBe(RAW_TITLE);
    expect(data.reviews[0]?.body).toBe(RAW_BODY);
    expect(data.reviews[0]?.title).not.toContain("&amp;");
    expect(data.reviews[0]?.title).not.toContain("&lt;");
    expect(JSON.stringify(data)).not.toMatch(/authorEmail/i);
  });
});

describe("JSON-LD email guard + script safety", () => {
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

  it("never includes authorEmail and omits PENDING-only aggregates", () => {
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
          title: RAW_TITLE,
          body: RAW_BODY,
          authorDisplayName: "Ana S.",
          submittedAt: "2026-09-10T12:00:00Z",
          verificationStatus: "unverified",
          merchantReply: "",
          merchantRepliedAt: null,
        },
      ],
    });
    expect(withPublished.aggregateRating).toMatchObject({ ratingValue: 5, reviewCount: 1 });
    // Object payload keeps literals (React / JSON.stringify path).
    const review = (withPublished as { review: Array<{ name: string; reviewBody: string }> }).review[0];
    expect(review?.name).toBe(RAW_TITLE);
    expect(review?.reviewBody).toBe(RAW_BODY);
    expect(JSON.stringify(withPublished)).not.toMatch(/authorEmail/i);
    expect(JSON.stringify(withPublished)).not.toContain("&amp;");

    // Shared <script> serializer escapes "<" once (safeJsonLd).
    const scriptPayload = safeJsonLd(withPublished);
    expect(scriptPayload).toContain("\\u003c");
    expect(scriptPayload).not.toContain("<");
    expect(() =>
      assertNoAuthorEmail({ authorEmail: "secret@example.com" }),
    ).toThrow(/authorEmail/);
  });
});
