import { render, screen } from "@testing-library/react";

import type { ProductSummary } from "@/lib/content/catalog";
import { ShopDiscovery } from "../shop-discovery";

const product = {
  slug: "new-necklace",
  title: "New necklace",
  image: "/necklace.jpg",
  price: "€120",
  tagNames: [],
  categoryName: "Necklaces",
} as ProductSummary;

describe("ShopDiscovery", () => {
  it("offers new, popular, and Shopify category pathways", () => {
    render(
      <ShopDiscovery
        newestProducts={[product]}
        popularProducts={[product]}
        categories={[{
          slug: "gid://shopify/TaxonomyCategory/aa-1",
          name: "Necklaces",
          image: "/necklace.jpg",
          count: 1,
        }]}
      />,
    );

    expect(screen.getByRole("heading", { name: /new arrivals/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /most popular/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /shop by category/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view all new arrivals/i })).toHaveAttribute("href", "/en/shop?sort=newest#shop-results");
    expect(screen.getByRole("link", { name: /view all most popular/i })).toHaveAttribute("href", "/en/shop?sort=popular#shop-results");
    expect(screen.getByRole("link", { name: /shop necklaces/i })).toHaveAttribute(
      "href",
      "/en/shop?category=gid%3A%2F%2Fshopify%2FTaxonomyCategory%2Faa-1#shop-results",
    );
  });

  it("does not claim popularity when Shopify ranking is unavailable", () => {
    render(
      <ShopDiscovery
        newestProducts={[product]}
        popularProducts={[]}
        showPopular={false}
        categories={[]}
      />,
    );

    expect(screen.queryByRole("heading", { name: /most popular/i })).not.toBeInTheDocument();
  });
});
