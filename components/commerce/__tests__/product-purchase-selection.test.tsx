import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/i18n/context", () => ({
  useTranslations: () => ({
    t: (key: string) => key,
    plural: (key: string) => key,
    locale: "en",
  }),
}));

vi.mock("@/components/commerce/add-to-cart-button", () => ({
  AddToCartButton: () => <button type="button">add</button>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/en/products/necklace",
  useSearchParams: () => new URLSearchParams(),
}));

import { ProductPurchasePanel } from "@/components/commerce/product-purchase-panel";
import { ProductPurchaseSelectionProvider } from "@/components/commerce/product-purchase-selection";
import type { ProductSummary } from "@/lib/content/catalog";

function makeProduct(overrides: Partial<ProductSummary> = {}): ProductSummary {
  return {
    shopifyProductId: null,
    slug: "necklace",
    sourceSlug: "necklace",
    sku: "N-1",
    series: "",
    title: "Necklace",
    shortDescription: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    price: "€40",
    priceAmount: 40,
    currency: "EUR",
    compareAtPrice: "",
    compareAtAmount: null,
    stockOnHand: 2,
    inStock: true,
    searchText: "",
    variantCount: 2,
    vendor: "",
    productType: "",
    shopifyCategoryName: "",
    commerceMedia: [],
    options: [{ name: "Length", values: ["40", "45"] }],
    variantDetails: [
      {
        merchandiseId: "gid://shopify/ProductVariant/1",
        title: "40",
        sku: "N-40",
        barcode: "",
        price: "€40",
        priceAmount: 40,
        compareAtPrice: "",
        compareAtAmount: null,
        stockOnHand: 2,
        available: true,
        weightGrams: null,
        selectedOptions: [{ name: "Length", value: "40" }],
      },
      {
        merchandiseId: "gid://shopify/ProductVariant/2",
        title: "45",
        sku: "N-45",
        barcode: "",
        price: "€42",
        priceAmount: 42,
        compareAtPrice: "",
        compareAtAmount: null,
        stockOnHand: 1,
        available: true,
        weightGrams: null,
        selectedOptions: [{ name: "Length", value: "45" }],
      },
    ],
    image: "/n.jpg",
    collectionSlug: "",
    collectionSlugs: [],
    collectionName: "",
    materialLine: "",
    attributes: [],
    characteristics: [],
    categorySlug: null,
    categoryName: null,
    tagSlugs: [],
    tagNames: [],
    publicMetafields: [],
    symbolismLabel: "",
    symbolismTitle: "",
    symbolismBody: "",
    symbolismBody2: "",
    materialsEyebrow: "",
    materialsTitle: "",
    materials: [],
    process: { eyebrow: "", title: "", body: "", stats: [], media: null },
    lookbookEyebrow: "",
    lookbookTitle: "",
    lookbook: [],
    ...overrides,
  } as ProductSummary;
}

describe("shared purchase selection", () => {
  it("keeps hero and compact panels on the same variant selection", async () => {
    const user = userEvent.setup();
    const product = makeProduct();

    render(
      <ProductPurchaseSelectionProvider products={[product]}>
        <ProductPurchasePanel product={product} />
        <ProductPurchasePanel product={product} compact />
      </ProductPurchaseSelectionProvider>,
    );

    const fortyFiveButtons = screen.getAllByRole("button", { name: "45" });
    expect(fortyFiveButtons).toHaveLength(2);

    await act(async () => {
      await user.click(fortyFiveButtons[0]);
    });

    for (const button of screen.getAllByRole("button", { name: "45" })) {
      expect(button).toHaveAttribute("aria-pressed", "true");
    }
    for (const button of screen.getAllByRole("button", { name: "40" })) {
      expect(button).toHaveAttribute("aria-pressed", "false");
    }
  });
});
