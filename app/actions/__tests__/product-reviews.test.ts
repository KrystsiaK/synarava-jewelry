import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findProduct: vi.fn(),
  checkRateLimit: vi.fn(),
  upsertLocalProductReview: vi.fn(),
  getProductReviewsSettings: vi.fn(),
  revalidateStorefrontPath: vi.fn(),
  headers: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db: { product: { findUnique: mocks.findProduct } } }));
vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/reviews/mutations", () => ({
  upsertLocalProductReview: mocks.upsertLocalProductReview,
}));
vi.mock("@/lib/reviews/settings", () => ({
  getProductReviewsSettings: mocks.getProductReviewsSettings,
}));
vi.mock("@/lib/content/revalidate-storefront", () => ({
  revalidateStorefrontPath: mocks.revalidateStorefrontPath,
}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));

import { submitProductReviewAction } from "../product-reviews";

function reviewFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("productSlug", "lava-ring");
  formData.set("rating", "5");
  formData.set("title", "Beautiful");
  formData.set("body", "Even better in person.");
  formData.set("locale", "en");
  formData.set("authorName", "Ana Silva");
  formData.set("authorEmail", "ana@example.com");
  formData.set("company", "");
  for (const [key, value] of Object.entries(overrides)) {
    formData.set(key, value);
  }
  return formData;
}

const emptyOutcome = {
  reviews: { average: null, count: 0, reviews: [] },
  blockedHidden: false,
  storefrontChanged: false,
};

describe("submitProductReviewAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.findProduct.mockResolvedValue({ id: "prod_1" });
    mocks.getProductReviewsSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.upsertLocalProductReview.mockResolvedValue(emptyOutcome);
    mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "1.2.3.4" }));
  });

  it("submits without a customer session", async () => {
    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toMatchObject({
      notice: "pendingModeration",
    });
    expect(mocks.upsertLocalProductReview).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: "prod_1",
        authorEmail: "ana@example.com",
        authorName: "Ana Silva",
        rating: 5,
      }),
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "product-review-ip",
      "1.2.3.4",
      expect.objectContaining({ max: 5 }),
    );
    expect(mocks.checkRateLimit).toHaveBeenCalledWith(
      "product-review-email",
      "ana@example.com",
      expect.objectContaining({ max: 5 }),
    );
  });

  it("publishes immediately when moderation is off", async () => {
    mocks.getProductReviewsSettings.mockResolvedValue({ moderationBeforePublish: false });
    mocks.upsertLocalProductReview.mockResolvedValue({
      reviews: {
        average: 5,
        count: 1,
        reviews: [
          {
            id: "r1",
            rating: 5,
            title: "Beautiful",
            body: "Even better in person.",
            authorDisplayName: "Ana S.",
            submittedAt: "2026-11-15T00:00:00.000Z",
            verificationStatus: "unverified",
            merchantReply: "",
            merchantRepliedAt: null,
          },
        ],
      },
      blockedHidden: false,
      storefrontChanged: true,
    });

    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toMatchObject({
      notice: "success",
      average: 5,
      count: 1,
    });
    expect(mocks.revalidateStorefrontPath).toHaveBeenCalled();
  });

  it("rate-limits the 6th submission from one IP across different emails", async () => {
    let ipCount = 0;
    mocks.checkRateLimit.mockImplementation(async (action: string) => {
      if (action === "product-review-ip") {
        ipCount += 1;
        return ipCount <= 5 ? { ok: true } : { ok: false, error: "limited", retryAfterSeconds: 60 };
      }
      return { ok: true };
    });

    for (let i = 1; i <= 5; i++) {
      await expect(
        submitProductReviewAction({}, reviewFormData({ authorEmail: `user${i}@example.com` })),
      ).resolves.toMatchObject({ notice: "pendingModeration" });
    }

    await expect(
      submitProductReviewAction({}, reviewFormData({ authorEmail: "user6@example.com" })),
    ).resolves.toEqual({ notice: "rateLimited" });
    expect(mocks.upsertLocalProductReview).toHaveBeenCalledTimes(5);
  });

  it("soft-succeeds on honeypot without writing", async () => {
    await expect(
      submitProductReviewAction({}, reviewFormData({ company: "Acme Bot" })),
    ).resolves.toMatchObject({ notice: "success" });
    expect(mocks.upsertLocalProductReview).not.toHaveBeenCalled();
  });

  it("returns neutral success when HIDDEN (moderation on) without leaking status", async () => {
    mocks.getProductReviewsSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.upsertLocalProductReview.mockResolvedValue({
      reviews: { average: null, count: 0, reviews: [] },
      blockedHidden: true,
      storefrontChanged: false,
    });

    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toEqual({
      notice: "success",
      average: null,
      count: 0,
      reviews: [],
    });
    expect(mocks.revalidateStorefrontPath).not.toHaveBeenCalled();
  });

  it("returns neutral success when HIDDEN (moderation off) without publishing", async () => {
    mocks.getProductReviewsSettings.mockResolvedValue({ moderationBeforePublish: false });
    mocks.upsertLocalProductReview.mockResolvedValue({
      reviews: { average: null, count: 0, reviews: [] },
      blockedHidden: true,
      storefrontChanged: false,
    });

    await expect(submitProductReviewAction({}, reviewFormData())).resolves.toEqual({
      notice: "success",
      average: null,
      count: 0,
      reviews: [],
    });
    expect(mocks.revalidateStorefrontPath).not.toHaveBeenCalled();
  });

  it("validates fields before writing", async () => {
    await expect(
      submitProductReviewAction({}, reviewFormData({ rating: "9", body: "short" })),
    ).resolves.toMatchObject({
      notice: "checkFields",
      fieldErrors: expect.objectContaining({ rating: "rating", body: "body" }),
    });
    expect(mocks.upsertLocalProductReview).not.toHaveBeenCalled();
  });
});
