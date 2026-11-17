import { describe, expect, it } from "vitest";

import { aggregatePublishedReviews } from "@/lib/reviews/aggregate";

describe("aggregatePublishedReviews", () => {
  it("ignores PENDING and HIDDEN rows", () => {
    expect(
      aggregatePublishedReviews([
        { rating: 5, status: "PUBLISHED" },
        { rating: 1, status: "PENDING" },
        { rating: 2, status: "HIDDEN" },
        { rating: 3, status: "PUBLISHED" },
      ]),
    ).toEqual({ average: 4, count: 2 });
  });

  it("returns empty aggregate when nothing is published", () => {
    expect(
      aggregatePublishedReviews([
        { rating: 5, status: "PENDING" },
        { rating: 4, status: "HIDDEN" },
      ]),
    ).toEqual({ average: null, count: 0 });
  });
});
