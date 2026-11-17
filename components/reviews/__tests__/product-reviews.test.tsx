import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/product-reviews", () => ({
  submitProductReviewAction: vi.fn(),
}));

import { ProductReviews } from "../product-reviews";

const reviews = [
  {
    id: "review-1",
    rating: 5,
    title: "A lasting piece",
    body: "Beautifully made and thoughtfully presented.",
    authorDisplayName: "Ana",
    submittedAt: "2026-09-10T12:00:00Z",
    verificationStatus: "verified_buyer" as const,
    merchantReply: "Thank you, Ana.",
    merchantRepliedAt: "2026-09-11T12:00:00Z",
  },
];

describe("ProductReviews", () => {
  it("shows published reviews and a public submit form", () => {
    render(
      <ProductReviews
        productSlug="lava-ring"
        locale="en"
        submitAction={async () => ({})}
        data={{ reviews, average: 5, count: 1 }}
      />,
    );

    expect(screen.getByRole("heading", { name: "Customer reviews" })).toBeInTheDocument();
    expect(screen.getByText("Verified buyer")).toBeInTheDocument();
    expect(screen.getByLabelText("Your name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Sign in/i })).not.toBeInTheDocument();
  });

  it("shows an accessible five-star review form", () => {
    render(
      <ProductReviews
        productSlug="lava-ring"
        locale="en"
        submitAction={async () => ({})}
        data={{ reviews: [], average: null, count: 0 }}
      />,
    );

    expect(screen.getByRole("radiogroup", { name: "Your rating" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "5 stars" })).toBeInTheDocument();
    expect(screen.getByLabelText("Review (optional)")).toHaveAttribute("maxlength", "2000");
    expect(screen.getByRole("button", { name: "Submit review" })).toBeInTheDocument();
  });
});
