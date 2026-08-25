import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";

import { ProductPurchasePanel } from "@/components/commerce/product-purchase-panel";
import type { ProductSummary } from "@/lib/content/catalog";

vi.mock("@/components/commerce/add-to-cart-button", () => ({
  AddToCartButton: ({ merchandiseId, disabled }: { merchandiseId?: string; disabled?: boolean }) => (
    <button type="button" disabled={disabled} data-merchandise-id={merchandiseId}>Add</button>
  ),
}));

const product = {
  slug: "woven-collar",
  price: "€30.00",
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
    expect(screen.getByText("2 pieces available")).toBeInTheDocument();
  });

  it("updates the merchandise id, price, and stock when an option changes", () => {
    render(<ProductPurchasePanel product={product} />);
    fireEvent.click(screen.getByRole("button", { name: "Large" }));
    expect(screen.getByRole("button", { name: "Add" })).toHaveAttribute(
      "data-merchandise-id",
      "gid://shopify/ProductVariant/large",
    );
    expect(screen.getByText("€34.00")).toBeInTheDocument();
    expect(screen.getByText("1 piece available")).toBeInTheDocument();
  });

  it("disables an option that has no available linked variant", () => {
    const unavailable = {
      ...product,
      variantDetails: product.variantDetails.map((variant) =>
        variant.title === "Large" ? { ...variant, stockOnHand: 0 } : variant,
      ),
    };
    render(<ProductPurchasePanel product={unavailable} />);
    expect(screen.getByRole("button", { name: "Large" })).toBeDisabled();
  });
});
