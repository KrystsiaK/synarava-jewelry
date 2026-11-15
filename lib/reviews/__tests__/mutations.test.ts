import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/reviews/settings", () => ({
  getProductReviewsSettings: mocks.getSettings,
}));
vi.mock("@/lib/db", () => ({
  db: {
    productReview: {
      upsert: mocks.upsert,
      findMany: mocks.findMany,
    },
  },
}));

import { upsertLocalProductReview } from "@/lib/reviews/mutations";

describe("upsertLocalProductReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
  });

  it("creates PENDING when moderation is on and normalizes email", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.upsert.mockResolvedValue({});

    await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 5,
      title: "Nice",
      body: "Really nice piece.",
      authorName: "Ana Silva",
      authorEmail: "Ana@Example.com",
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId_authorEmail: { productId: "p1", authorEmail: "ana@example.com" },
        },
        create: expect.objectContaining({
          status: "PENDING",
          authorName: "Ana S.",
          authorEmail: "ana@example.com",
        }),
        update: expect.objectContaining({
          status: "PENDING",
          authorName: "Ana S.",
        }),
      }),
    );
  });

  it("creates PUBLISHED when moderation is off", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: false });
    mocks.upsert.mockResolvedValue({});
    mocks.findMany.mockResolvedValue([
      {
        id: "r1",
        rating: 4,
        title: "Ok",
        body: "Fine enough.",
        authorName: "Ana S.",
        status: "PUBLISHED",
        verifiedPurchase: false,
        createdAt: new Date("2026-11-15T00:00:00Z"),
      },
    ]);

    const result = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 4,
      title: "Ok",
      body: "Fine enough.",
      authorName: "Ana",
      authorEmail: "ana@example.com",
    });

    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "PUBLISHED" }),
        update: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(result.count).toBe(1);
  });
});
