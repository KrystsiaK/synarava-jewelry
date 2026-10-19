import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({ t: (key: string) => key, locale: "en" }),
}));

vi.mock("@/components/content/rich-text", () => ({ RichText: () => null }));

import { ProductCard } from "@/components/ui/product-card";
import type { ShopListingProduct } from "@/lib/content/shop-listing";

function product(overrides: Partial<ShopListingProduct> = {}): ShopListingProduct {
  return {
    id: "p1",
    shopifyProductId: null,
    slug: "amber-ring",
    sourceTitle: "Amber ring",
    series: "",
    title: "Amber ring",
    shortDescription: "",
    price: "€80",
    priceAmount: 80,
    compareAtPrice: "",
    compareAtAmount: null,
    image: "/x.webp",
    inStock: true,
    searchText: "amber ring",
    categorySlug: null,
    categoryName: "",
    productType: "",
    productTypeLabel: "",
    materialLabel: "",
    collectionSlugs: [],
    tagSlugs: [],
    tagNames: [],
    characteristics: [],
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as ShopListingProduct;
}

describe("ProductCard prices", () => {
  it("shows the struck-through original price and the discount badge for a discounted product", () => {
    render(
      <ProductCard
        product={product({ compareAtPrice: "€100", compareAtAmount: 100 })}
        index={0}
        isParentInView
      />,
    );

    expect(screen.getByText("€80")).toBeInTheDocument();
    expect(screen.getByText("€100")).toHaveClass("line-through");
    expect(screen.getByText("−20%")).toBeInTheDocument();
  });

  it("shows no original price or badge when there is no discount", () => {
    const { container } = render(<ProductCard product={product()} index={0} isParentInView />);

    expect(screen.getByText("€80")).toBeInTheDocument();
    expect(container.querySelector(".line-through")).toBeNull();
    expect(screen.queryByText(/−\d+%/)).toBeNull();
  });
});
