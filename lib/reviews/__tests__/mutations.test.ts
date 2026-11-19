import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  create: vi.fn(),
  upsert: vi.fn(),
  findMany: vi.fn(),
  findUnique: vi.fn(),
}));

vi.mock("@/lib/reviews/settings", () => ({
  getProductReviewsSettings: mocks.getSettings,
}));
vi.mock("@/lib/db", () => ({
  db: {
    productReview: {
      create: mocks.create,
      upsert: mocks.upsert,
      findMany: mocks.findMany,
      findUnique: mocks.findUnique,
    },
  },
}));

import { upsertLocalProductReview } from "@/lib/reviews/mutations";

describe("upsertLocalProductReview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([]);
    mocks.findUnique.mockResolvedValue(null);
  });

  it("creates PENDING when moderation is on and normalizes email", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.create.mockResolvedValue({});

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 5,
      title: "Nice",
      body: "Really nice piece.",
      authorName: "Ana Silva",
      authorEmail: "Ana@Example.com",
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: "p1",
          status: "PENDING",
          authorName: "Ana S.",
          authorEmail: "ana@example.com",
        }),
      }),
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: false, storefrontChanged: false });
  });

  it("creates PUBLISHED when moderation is off", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: false });
    mocks.create.mockResolvedValue({});
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

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(result.reviews.count).toBe(1);
    expect(result.storefrontChanged).toBe(true);
    expect(result.blockedHidden).toBe(false);
  });

  it("new email creates PENDING", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.create.mockResolvedValue({});
    mocks.findUnique.mockResolvedValue(null);

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 5,
      title: "Fresh",
      body: "Brand new reviewer email.",
      authorName: "New Guest",
      authorEmail: "fresh@example.com",
    });

    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authorEmail: "fresh@example.com",
          status: "PENDING",
        }),
      }),
    );
    expect(outcome).toMatchObject({ blockedHidden: false, storefrontChanged: false });
  });

  it("resubmit with another person's email must NOT change a PUBLISHED review", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.findUnique.mockResolvedValue({
      status: "PUBLISHED",
      rating: 5,
      title: "Original title",
      body: "Original body that must stay.",
    });
    mocks.findMany.mockResolvedValue([
      {
        id: "r-published",
        rating: 5,
        title: "Original title",
        body: "Original body that must stay.",
        authorName: "Victim V.",
        status: "PUBLISHED",
        verifiedPurchase: false,
        createdAt: new Date("2026-11-01T00:00:00Z"),
      },
    ]);

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 1,
      title: "Hijacked",
      body: "Attacker overwrites with another person's email.",
      authorName: "Attacker",
      authorEmail: "victim@example.com",
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: true, storefrontChanged: false });
    expect(outcome.reviews.reviews[0]).toMatchObject({
      rating: 5,
      title: "Original title",
      body: "Original body that must stay.",
    });
  });

  it("leaves a HIDDEN review untouched when moderation is on", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.findUnique.mockResolvedValue({ status: "HIDDEN" });

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 5,
      title: "Try again",
      body: "Please publish me.",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: true, storefrontChanged: false });
  });

  it("leaves a HIDDEN review untouched when moderation is off", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: false });
    mocks.findUnique.mockResolvedValue({ status: "HIDDEN" });

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "pt",
      rating: 1,
      title: "Force publish",
      body: "Should still stay hidden.",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: true, storefrontChanged: false });
  });

  it("leaves a PENDING review untouched (shared existing-row branch)", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.findUnique.mockResolvedValue({ status: "PENDING" });

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 2,
      title: "Rewrite pending",
      body: "Should not replace the pending row.",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
    });

    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: true, storefrontChanged: false });
  });

  it("treats concurrent create unique violation as blocked existing", async () => {
    mocks.getSettings.mockResolvedValue({ moderationBeforePublish: true });
    mocks.findUnique.mockResolvedValue(null);
    mocks.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    const outcome = await upsertLocalProductReview({
      productId: "p1",
      locale: "en",
      rating: 1,
      title: "Race",
      body: "Second concurrent submit with same email.",
      authorName: "Ana Silva",
      authorEmail: "ana@example.com",
    });

    expect(mocks.create).toHaveBeenCalled();
    expect(outcome).toMatchObject({ blockedHidden: true, storefrontChanged: false });
  });
});
