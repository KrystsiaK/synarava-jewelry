import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/product-reviews", () => ({
  submitProductReviewAction: vi.fn(),
}));

import { ProductReviews } from "../product-reviews";

const reviews = [{
  id: "review-1",
  handle: "review-1",
  rating: 5,
  title: "A lasting piece",
  body: "Beautifully made and thoughtfully presented.",
  authorDisplayName: "Ana",
  submittedAt: "2026-09-10T12:00:00Z",
  verificationStatus: "verified_buyer" as const,
  merchantReply: "Thank you, Ana.",
  merchantRepliedAt: "2026-09-11T12:00:00Z",
}];

describe("ProductReviews", () => {
  it("shows Shopify reviews and asks signed-out visitors to sign in before writing", () => {
    render(
      <ProductReviews
        productSlug="lava-ring"
        locale="en"
        isSignedIn={false}
        submitAction={async () => ({})}
        data={{ reviews, average: 5, count: 1 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Customer reviews" })).toBeInTheDocument();
    expect(screen.getByText("Verified buyer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in to write a review" })).toHaveAttribute(
      "href",
      "/en/login?redirectTo=%2Fen%2Fproducts%2Flava-ring%23reviews",
    );
  });

  it("shows an accessible five-star review form to signed-in customers", () => {
    render(
      <ProductReviews
        productSlug="lava-ring"
        locale="en"
        isSignedIn
        submitAction={async () => ({})}
        data={{ reviews: [], average: null, count: 0 }}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Your rating" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeInTheDocument();
    expect(screen.getByLabelText("Review (optional)")).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: "Publish review" })).toBeInTheDocument();
  });
});
