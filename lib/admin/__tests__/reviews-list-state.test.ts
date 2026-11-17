import { describe, expect, it } from "vitest";

import {
  parseAdminReviewsListState,
  toAdminReviewListFilters,
} from "@/lib/admin/reviews-list-state";
import { listStateToSearchString } from "@/lib/list-state";
import { adminReviewsListSchema } from "@/lib/admin/reviews-list-state";

describe("admin reviews list-state", () => {
  it("parses filters from search params", () => {
    const state = parseAdminReviewsListState({
      status: "PENDING",
      rating: "5",
      locale: "pt",
      q: "lava",
      from: "2026-01-01",
      to: "2026-12-31",
      sort: "rating_desc",
      page: "2",
    });
    expect(toAdminReviewListFilters(state)).toMatchObject({
      status: "PENDING",
      rating: 5,
      locale: "pt",
      q: "lava",
      dateFrom: "2026-01-01",
      dateTo: "2026-12-31",
      sort: "rating_desc",
      page: 2,
    });
  });

  it("round-trips shareable query strings", () => {
    const state = parseAdminReviewsListState({ status: "HIDDEN", q: "ana" });
    const qs = listStateToSearchString(adminReviewsListSchema, state);
    expect(qs).toContain("status=HIDDEN");
    expect(qs).toContain("q=ana");
  });
});
