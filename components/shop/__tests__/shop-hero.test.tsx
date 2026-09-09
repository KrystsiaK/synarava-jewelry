import { render, screen } from "@testing-library/react";

import type { ProductSummary } from "@/lib/content/catalog";
import { ShopHero } from "../shop-page";

const leadProduct = {
  image: "/shop-cover.jpg",
  title: "Editorial shop cover",
} as ProductSummary;

describe("ShopHero", () => {
  it("presents the shop with one static image and leaves department navigation to filters", () => {
    const { container } = render(<ShopHero leadProduct={leadProduct} archiveCount={12} />);

    expect(screen.getByRole("heading", { name: /curated shop/i })).toBeInTheDocument();
    expect(screen.getByTestId("shop-hero-media")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
