import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getShopifyCustomerProfile: vi.fn(),
  findShopifyCustomerOrderForProduct: vi.fn(),
  findProduct: vi.fn(),
  checkRateLimit: vi.fn(),
  upsertShopifyProductReview: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
}));

vi.mock("@/lib/shopify/customer-account/api", () => ({
  getShopifyCustomerProfile: mocks.getShopifyCustomerProfile,
  findShopifyCustomerOrderForProduct: mocks.findShopifyCustomerOrderForProduct,
}));
vi.mock("@/lib/db", () => ({ db: { product: { findUnique: mocks.findProduct } } }));
vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/shopify/product-reviews", () => ({
  upsertShopifyProductReview: mocks.upsertShopifyProductReview,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefrontPath,
}));

import { submitProductReviewAction } from "../product-reviews";

function reviewFormData() {
  const formData = new FormData();
  formData.set("productSlug", "lava-ring");
  formData.set("rating", "5");
  formData.set("title", "Beautiful");
  formData.set("body", "Even better in person.");
  formData.set("locale", "en");
  return formData;
}

describe("submitProductReviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.findProduct.mockResolvedValue({ shopifyProductId: "gid://shopify/Product/10" });
    mocks.getShopifyCustomerProfile.mockResolvedValue({
      id: "gid://shopify/Customer/2",
      displayName: "Ana Silva",
      orders: {
        nodes: [{
          id: "gid://shopify/Order/3",
          lineItems: { nodes: [{ productId: "gid://shopify/Product/10" }] },
        }],
      },
    });
    mocks.upsertShopifyProductReview.mockResolvedValue({ average: 5, count: 1, reviews: [] });
    mocks.findShopifyCustomerOrderForProduct.mockResolvedValue("gid://shopify/Order/3");
  });

  it("requires a Shopify customer session", async () => {
    mocks.getShopifyCustomerProfile.mockResolvedValue(null);

    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toEqual({
      notice: "requiresLogin",
      requiresLogin: true,
    });
    expect(mocks.upsertShopifyProductReview).not.toHaveBeenCalled();
  });

  it("marks a review verified only when the customer ordered this Shopify product", async () => {
    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toMatchObject({
      notice: "success",
      average: 5,
      count: 1,
    });

    expect(mocks.upsertShopifyProductReview).toHaveBeenCalledWith(expect.objectContaining({
      productId: "gid://shopify/Product/10",
      customerId: "gid://shopify/Customer/2",
      orderId: "gid://shopify/Order/3",
      authorDisplayName: "Ana S.",
      language: "en",
    }));
  });

  it("submits an honest unverified review when no matching order exists", async () => {
    mocks.findShopifyCustomerOrderForProduct.mockResolvedValue(null);

    await submitProductReviewAction({}, reviewFormData());

    expect(mocks.upsertShopifyProductReview).toHaveBeenCalledWith(expect.objectContaining({
      orderId: null,
    }));
  });

  it("accepts a star-only rating with no written review", async () => {
    const formData = reviewFormData();
    formData.set("body", "");

    await expect(submitProductReviewAction({}, formData)).resolves.toMatchObject({
      notice: "success",
    });
    expect(mocks.upsertShopifyProductReview).toHaveBeenCalledWith(expect.objectContaining({ body: "" }));
  });

  it("validates review content before calling Shopify", async () => {
    const formData = reviewFormData();
    formData.set("rating", "9");
    formData.set("body", "short");

    await expect(submitProductReviewAction({}, formData)).resolves.toMatchObject({
      notice: "checkFields",
      fieldErrors: expect.objectContaining({ rating: "rating", body: "body" }),
    });
    expect(mocks.upsertShopifyProductReview).not.toHaveBeenCalled();
  });

  it("returns a recoverable error when Shopify customer verification is unavailable", async () => {
    mocks.getShopifyCustomerProfile.mockRejectedValue(new Error("Shopify unavailable"));

    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toEqual({
      notice: "verifyFailed",
    });
    expect(mocks.upsertShopifyProductReview).not.toHaveBeenCalled();
  });
});
