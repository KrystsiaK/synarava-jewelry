import { render, screen } from "@testing-library/react";

import { ShopHero } from "../shop-page";

const title = "Curated shop";
const description = "Jewelry, pet accessories, creative products for kids, and tools for making by hand.";

describe("ShopHero", () => {
  it("renders only the hero image explicitly configured for the shop page", () => {
    const { container } = render(
      <ShopHero heroImage="/shop-cover.jpg" title={title} description={description} archiveCount={12} />,
    );

    expect(screen.getByRole("heading", { name: /curated shop/i })).toBeInTheDocument();
    expect(screen.getByTestId("shop-hero-media")).toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(1);
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("keeps a neutral hero when no shop hero image is configured", () => {
    const { container } = render(<ShopHero title={title} description={description} archiveCount={12} />);

    expect(screen.queryByTestId("shop-hero-media")).not.toBeInTheDocument();
    expect(container.querySelectorAll("img")).toHaveLength(0);
  });

  it("splits a single-word title into just the accent run", () => {
    render(<ShopHero title="Shop" description={description} archiveCount={0} />);

    expect(screen.getByRole("heading", { name: /^shop$/i })).toBeInTheDocument();
  });
});
