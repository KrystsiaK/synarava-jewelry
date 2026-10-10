import { describe, expect, it } from "vitest";

import { STOREFRONT_REVIEWS_VISIBLE, storefrontReviewsVisible } from "../storefront-reviews";

describe("storefrontReviewsVisible", () => {
  it("is temporarily off so buyer-facing review surfaces stay hidden", () => {
    // Revert expectation (and STOREFRONT_REVIEWS_VISIBLE) when reviews return.
    expect(STOREFRONT_REVIEWS_VISIBLE).toBe(false);
    expect(storefrontReviewsVisible()).toBe(false);
  });
});
