import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/components/admin/shared/admin-toast", () => ({
  useAdminToast: () => ({ pushToast: vi.fn() }),
}));

vi.mock("@/app/admin/actions/reviews", () => ({
  moderateProductReviewsAction: vi.fn(async () => ({ success: "ok", updated: 1 })),
}));

import { ReviewsCms } from "../reviews-cms";

const emptyPage = {
  items: [],
  total: 0,
  page: 1,
  pageSize: 25,
};

const samplePage = {
  items: [
    {
      id: "r1",
      productId: "p1",
      productSlug: "lava-ring",
      productName: "Lava Ring",
      locale: "en",
      rating: 5,
      title: "Beautiful",
      body: "Love it",
      authorName: "Ana S.",
      authorEmail: "ana@example.com",
      status: "PENDING" as const,
      verifiedPurchase: false,
      createdAt: "2026-11-15T00:00:00.000Z",
      moderatedAt: null,
      moderatedBy: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
};

const initialListState = {
  q: "",
  status: "ALL" as const,
  product: "ALL",
  rating: "ALL" as const,
  locale: "ALL" as const,
  from: "",
  to: "",
  sort: "newest" as const,
  page: "1",
};

describe("ReviewsCms", () => {
  it("renders an empty table safely", () => {
    render(
      <ReviewsCms
        initialPage={emptyPage}
        initialListState={initialListState}
        products={[]}
      />,
    );
    expect(screen.getByText(/No reviews match these filters/i)).toBeInTheDocument();
  });

  it("asks for confirmation before hide", async () => {
    const user = userEvent.setup();
    render(
      <ReviewsCms
        initialPage={samplePage}
        initialListState={initialListState}
        products={[{ id: "p1", slug: "lava-ring", name: "Lava Ring" }]}
      />,
    );
    // Prefer the row icon action (aria-label), not the disabled bulk button.
    await user.click(screen.getAllByRole("button", { name: "Hide" }).at(-1)!);
    expect(screen.getByRole("heading", { name: /Hide review/i })).toBeInTheDocument();
  });

  it("exposes status filter options", () => {
    render(
      <ReviewsCms
        initialPage={samplePage}
        initialListState={initialListState}
        products={[]}
      />,
    );
    expect(screen.getByLabelText("Status")).toBeInTheDocument();
    expect(screen.getByLabelText("Search")).toBeInTheDocument();
  });
});
