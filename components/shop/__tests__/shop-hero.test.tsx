import { render, screen } from "@testing-library/react";

import { ShopHero } from "../shop-page";

describe("ShopHero", () => {
  it("renders only the hero image explicitly configured for the shop page", () => {
    const { container } = render(<ShopHero heroImage="/shop-cover.jpg" archiveCount={12} />);

    expect(screen.getByRole("heading", { name: /curated shop/i })).toBeInTheDocument();
    expect(screen.getByTestId("shop-hero-media")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps a neutral hero when no shop hero image is configured", () => {
    const { container } = render(<ShopHero archiveCount={12} />);

    expect(screen.queryByTestId("shop-hero-media")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
