import { render, screen } from "@testing-library/react";
import { CartSummaryPanel } from "../cart-summary-panel";

describe("CartSummaryPanel", () => {
  const base = { itemCount: 2, subtotal: "€480" };

  it("renders item count and subtotal", () => {
    render(<CartSummaryPanel {...base} />);
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("€480")).toBeInTheDocument();
  });

  it("renders CTA link when ctaHref and ctaLabel provided", () => {
    render(<CartSummaryPanel {...base} ctaHref="/checkout" ctaLabel="Proceed to checkout" />);
    const link = screen.getByRole("link", { name: "Proceed to checkout" });
    expect(link).toHaveAttribute("href", "/checkout");
  });

  it("does not render CTA when ctaHref is missing", () => {
    render(<CartSummaryPanel {...base} ctaLabel="Proceed" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("does not render CTA when ctaLabel is missing", () => {
    render(<CartSummaryPanel {...base} ctaHref="/checkout" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders note when provided", () => {
    render(<CartSummaryPanel {...base} note="Free shipping on orders over €300" />);
    expect(screen.getByText("Free shipping on orders over €300")).toBeInTheDocument();
  });

  it("does not render note when omitted", () => {
    render(<CartSummaryPanel {...base} />);
    expect(screen.queryByText(/shipping/)).not.toBeInTheDocument();
  });
});
