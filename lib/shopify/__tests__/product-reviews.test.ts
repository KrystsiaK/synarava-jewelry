import { describe, expect, it, vi } from "vitest";

const shopifyAdminRequestMock = vi.hoisted(() => vi.fn());

vi.mock("../admin", async () => {
  const actual = await vi.importActual<typeof import("../admin")>("../admin");
  return { ...actual, shopifyAdminRequest: shopifyAdminRequestMock };
});

import {
  buildProductReviewInput,
  ensureProductReviewWebhookSubscriptions,
  parseProductReviewMetaobject,
  productReviewAggregate,
} from "../product-reviews";

describe("Shopify standard product reviews", () => {
  it("maps an active standard product_review metaobject", () => {
    expect(parseProductReviewMetaobject({
      id: "gid://shopify/Metaobject/1",
      handle: "review-1",
      capabilities: { publishable: { status: "ACTIVE" } },
      rating: { value: JSON.stringify({ scale_min: "1.0", scale_max: "5.0", value: "4.0" }) },
      title: { value: "Beautifully made" },
      body: { value: "The finish is even better in person." },
      product: { value: "gid://shopify/Product/10" },
      authorDisplayName: { value: "Marta" },
      submittedAt: { value: "2026-09-10T12:00:00Z" },
      appVerificationStatus: { value: "verified_buyer" },
      merchantReply: { value: "Thank you, Marta." },
      merchantRepliedAt: { value: "2026-09-11T12:00:00Z" },
    }, "gid://shopify/Product/10")).toMatchObject({
      id: "gid://shopify/Metaobject/1",
      rating: 4,
      title: "Beautifully made",
      authorDisplayName: "Marta",
      verificationStatus: "verified_buyer",
      merchantReply: "Thank you, Marta.",
    });
  });

  it("ignores drafts, another product, and malformed ratings", () => {
    const base = {
      id: "review",
      handle: "review",
      capabilities: { publishable: { status: "ACTIVE" } },
      rating: { value: JSON.stringify({ scale_min: "1", scale_max: "5", value: "5" }) },
      title: null,
      body: null,
      product: { value: "gid://shopify/Product/10" },
      authorDisplayName: null,
      submittedAt: { value: "2026-09-10T12:00:00Z" },
      appVerificationStatus: { value: "unverified" },
      merchantReply: null,
      merchantRepliedAt: null,
    };

    expect(parseProductReviewMetaobject({ ...base, capabilities: { publishable: { status: "DRAFT" } } }, "gid://shopify/Product/10")).toBeNull();
    expect(parseProductReviewMetaobject(base, "gid://shopify/Product/11")).toBeNull();
    expect(parseProductReviewMetaobject({ ...base, rating: { value: "not-json" } }, "gid://shopify/Product/10")).toBeNull();
  });

  it("builds only Shopify's standard fields", () => {
    expect(buildProductReviewInput({
      rating: 5,
      title: "Perfect gift",
      body: "Arrived beautifully presented.",
      productId: "gid://shopify/Product/10",
      customerId: "gid://shopify/Customer/2",
      authorDisplayName: "Ana",
      orderId: "gid://shopify/Order/3",
      language: "pt",
      submittedAt: "2026-09-10T12:00:00.000Z",
    })).toEqual({
      fields: [
        { key: "rating", value: JSON.stringify({ scale_min: "1.0", scale_max: "5.0", value: "5.0" }) },
        { key: "title", value: "Perfect gift" },
        { key: "body", value: "Arrived beautifully presented." },
        { key: "submitted_at", value: "2026-09-10T12:00:00.000Z" },
        { key: "published_at", value: "2026-09-10T12:00:00.000Z" },
        { key: "source", value: "synarava_storefront" },
        { key: "author", value: "gid://shopify/Customer/2" },
        { key: "author_display_name", value: "Ana" },
        { key: "order", value: "gid://shopify/Order/3" },
        { key: "product", value: "gid://shopify/Product/10" },
        { key: "language", value: "pt" },
        { key: "app_verification_status", value: "verified_buyer" },
      ],
      capabilities: { publishable: { status: "ACTIVE" } },
    });
  });

  it("calculates the aggregate Shopify metafield values", () => {
    expect(productReviewAggregate([{ rating: 5 }, { rating: 4 }, { rating: 3 }])).toEqual({
      average: 4,
      count: 3,
      ratingValue: JSON.stringify({ value: "4.0", scale_min: "1.0", scale_max: "5.0" }),
      countValue: "3",
    });
  });

  it("subscribes to every Shopify product-review metaobject lifecycle topic", async () => {
    shopifyAdminRequestMock
      .mockResolvedValueOnce({
        standardMetaobjectDefinitionEnable: {
          metaobjectDefinition: { id: "gid://shopify/MetaobjectDefinition/1" },
          userErrors: [],
        },
      })
      .mockResolvedValue({
        webhookSubscriptionCreate: {
          webhookSubscription: { id: "gid://shopify/WebhookSubscription/1" },
          userErrors: [],
        },
      });

    const result = await ensureProductReviewWebhookSubscriptions("https://synarava.com/");

    expect(result).toHaveLength(3);
    expect(shopifyAdminRequestMock.mock.calls.slice(-3).map((call) => call[1])).toEqual([
      { topic: "METAOBJECTS_CREATE", subscription: { uri: "https://synarava.com/api/shopify/webhooks/reviews", format: "JSON", filter: "type:product_review" } },
      { topic: "METAOBJECTS_UPDATE", subscription: { uri: "https://synarava.com/api/shopify/webhooks/reviews", format: "JSON", filter: "type:product_review" } },
      { topic: "METAOBJECTS_DELETE", subscription: { uri: "https://synarava.com/api/shopify/webhooks/reviews", format: "JSON", filter: "type:product_review" } },
    ]);
  });
});
