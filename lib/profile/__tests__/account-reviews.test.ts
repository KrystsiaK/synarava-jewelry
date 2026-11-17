import { describe, expect, it } from "vitest";

import { toAccountReviewRows } from "@/lib/profile/account-reviews";

describe("toAccountReviewRows", () => {
  it("links a review to the local product and leaves a missing product untitled", () => {
    const rows = toAccountReviewRows(
      [
        {
          id: "review-1",
          rating: 4,
          title: "Quiet",
          body: "Light on the hand.",
          submittedAt: "2026-09-10T12:00:00.000Z",
          verificationStatus: "unverified",
          merchantReply: "",
          productId: "prod_1",
          productSlug: "lava-ring",
          productTitle: "Lava ring",
        },
        {
          id: "review-2",
          rating: 5,
          title: "",
          body: "",
          submittedAt: "2026-09-11T12:00:00.000Z",
          verificationStatus: "verified_buyer",
          merchantReply: "",
          productId: "prod_missing",
          productSlug: "",
          productTitle: "",
        },
      ],
      (slug) => `/en/products/${slug}`,
    );

    expect(rows[0]).toMatchObject({
      productTitle: "Lava ring",
      productHref: "/en/products/lava-ring",
    });
    expect(rows[1]).toMatchObject({ productTitle: null, productHref: null });
  });
});
