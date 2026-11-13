import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ProductPurchasePanel } from "@/components/commerce/product-purchase-panel";
import type { ProductSummary } from "@/lib/content/catalog";
import { TranslationProvider } from "@/lib/i18n/context";

vi.mock("@/components/commerce/add-to-cart-button", () => ({
  AddToCartButton: ({ merchandiseId, disabled }: { merchandiseId?: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled} data-merchandise-id={merchandiseId}>Add</button>
  ),
}));

const RESTOCK_NOTICE = "Back in stock in about 10 days";

function renderPanel(
  panelProduct: ProductSummary,
  overrides?: Record<string, string>,
) {
  return render(
    <TranslationProvider
      initialLocale="en"
      initialOverrides={{ en: { "product.restockNotice": RESTOCK_NOTICE, ...overrides } }}
    >
      <ProductPurchasePanel product={panelProduct} />
    </TranslationProvider>,
  );
}

const product = {
  slug: "woven-collar",
  price: "€30.00",
  characteristics: [],
  options: [{ name: "Size", values: ["Small", "Large"] }],
  variantDetails: [
    {
      merchandiseId: "gid://shopify/ProductVariant/small",
      title: "Small",
      sku: "SMALL",
      barcode: "",
      price: "€30.00",
      compareAtPrice: "",
      stockOnHand: 2,
      available: true,
      weightGrams: null,
      selectedOptions: [{ name: "Size", value: "Small" }],
    },
    {
      merchandiseId: "gid://shopify/ProductVariant/large",
      title: "Large",
      sku: "LARGE",
      barcode: "",
      price: "€34.00",
      compareAtPrice: "",
      stockOnHand: 1,
      available: true,
      weightGrams: null,
      selectedOptions: [{ name: "Size", value: "Large" }],
    },
  ],
} as ProductSummary;

describe("ProductPurchasePanel", () => {
  it("starts with an available Shopify variant", () => {
    render(<ProductPurchasePanel product={product} />);
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "data-merchandise-id",
      "gid://shopify/ProductVariant/small",
    );
    expect(screen.getByText("2 in stock")).toBeInTheDocument();
  });

  it("updates the merchandise id, price, and stock when an option changes", () => {
    render(<ProductPurchasePanel product={product} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "data-merchandise-id",
      "gid://shopify/ProductVariant/large",
    );
    expect(screen.getByText("€34.00")).toBeInTheDocument();
    expect(screen.getByText("1 in stock")).toBeInTheDocument();
  });

  it("disables an option that has no available linked variant", () => {
    const unavailable = {
      ...product,
      variantDetails: product.variantDetails.map((variant) =>
        variant.title === "Large" ? { ...variant, stockOnHand: 0, available: false } : variant,
      ),
    };
    render(<ProductPurchasePanel product={unavailable} />);
    expect(screen.getByRole("button", { name: "Large" })).toBeDisabled();
  });

  it("blocks purchase when every variant is out of stock", () => {
    const unavailable = {
      ...product,
      variantDetails: product.variantDetails.map((variant) => ({ ...variant, stockOnHand: 0, available: false })),
    };

    render(<ProductPurchasePanel product={unavailable} />);

    expect(screen.getByText("This option is unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled();
  });

  it("shows the restock notice when the selected variant is sold out", () => {
    const soldOut = {
      ...product,
      variantDetails: product.variantDetails.map((variant) => ({
        ...variant,
        stockOnHand: 0,
        available: false,
      })),
    };

    renderPanel(soldOut);

    expect(screen.getByText("This option is unavailable")).toBeInTheDocument();
    expect(screen.getByText(RESTOCK_NOTICE)).toBeInTheDocument();
  });

  it("hides the restock notice when the selected variant is in stock", () => {
    renderPanel(product);

    expect(screen.getByText("2 in stock")).toBeInTheDocument();
    expect(screen.queryByText(RESTOCK_NOTICE)).not.toBeInTheDocument();
  });

  it("hides the restock notice when the admin override is empty", () => {
    const soldOut = {
      ...product,
      variantDetails: product.variantDetails.map((variant) => ({
        ...variant,
        stockOnHand: 0,
        available: false,
      })),
    };

    renderPanel(soldOut, { "product.restockNotice": "" });

    expect(screen.getByText("This option is unavailable")).toBeInTheDocument();
    expect(screen.queryByText(RESTOCK_NOTICE)).not.toBeInTheDocument();
  });

  it("does not show the restock notice for choose-an-option or Shopify-unavailable states", () => {
    const needsOption = {
      ...product,
      options: [{ name: "Size", values: ["Small", "Large"] }],
      variantDetails: [],
    } as ProductSummary;

    renderPanel(needsOption);
    expect(screen.getByText("Unavailable")).toBeInTheDocument();
    expect(screen.queryByText(RESTOCK_NOTICE)).not.toBeInTheDocument();
  });

  it("shows only the selected variant's own discount, not a sibling variant's compare-at (REV-06)", () => {
    const discountedFirstVariant = {
      ...product,
      price: "€100.00",
      priceAmount: 100,
      compareAtPrice: "€200.00",
      compareAtAmount: 200,
      variantDetails: [
        {
          ...product.variantDetails[0],
          price: "€100.00",
          priceAmount: 100,
          compareAtPrice: "€200.00",
          compareAtAmount: 200,
        },
        {
          ...product.variantDetails[1],
          price: "€100.00",
          priceAmount: 100,
          compareAtPrice: "",
          compareAtAmount: null,
        },
      ],
    } as ProductSummary;

    render(<ProductPurchasePanel product={discountedFirstVariant} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));

    expect(screen.queryByText("€200.00")).not.toBeInTheDocument();
    expect(screen.queryByText("−50%")).not.toBeInTheDocument();
  });

  it("moves to an available combination instead of trapping multi-option selection", () => {
    const multiOptionProduct = {
      ...product,
      options: [
        { name: "Color", values: ["Red", "Blue"] },
        { name: "Size", values: ["Small", "Large"] },
      ],
      variantDetails: [
        {
          ...product.variantDetails[0],
          merchandiseId: "gid://shopify/ProductVariant/red-small",
          selectedOptions: [
            { name: "Color", value: "Red" },
            { name: "Size", value: "Small" },
          ],
        },
        {
          ...product.variantDetails[1],
          merchandiseId: "gid://shopify/ProductVariant/blue-large",
          selectedOptions: [
            { name: "Color", value: "Blue" },
            { name: "Size", value: "Large" },
          ],
        },
      ],
    } as ProductSummary;

    render(<ProductPurchasePanel product={multiOptionProduct} />);
    fireEvent.click(screen.getByRole("button", { name: "Blue" }));

    expect(screen.getByRole("button", { name: "Blue" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Large" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "data-merchandise-id",
      "gid://shopify/ProductVariant/blue-large",
    );
  });

  it("keeps purchase actions free of service links and care copy", () => {
    render(<ProductPurchasePanel product={product} />);

    expect(screen.queryByText("Choose the right fit")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Delivery/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Returns/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Care & safety/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Purchase information" })).not.toBeInTheDocument();
  });

  it("keeps the repeated compact purchase action free of duplicate service navigation", () => {
    render(<ProductPurchasePanel product={product} compact />);
    expect(screen.queryByRole("navigation", { name: "Purchase information" })).not.toBeInTheDocument();
  });
});
