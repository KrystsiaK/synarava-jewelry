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

  it("keeps service links beside the purchase action without invented care copy", () => {
    render(<ProductPurchasePanel product={{ ...product, departmentSlug: "pets" }} />);

    expect(screen.queryByText("Choose the right fit")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Delivery/ })).toHaveAttribute("href", "/en/shipping");
    expect(screen.getByRole("link", { name: /Returns/ })).toHaveAttribute("href", "/en/returns");
    expect(screen.getByRole("link", { name: /Care & safety/ })).toHaveAttribute("href", "/en/care");
  });

  it("keeps the repeated compact purchase action free of duplicate service navigation", () => {
    render(<ProductPurchasePanel product={product} compact />);
    expect(screen.queryByRole("navigation", { name: "Purchase information" })).not.toBeInTheDocument();
  });

  it("shows the product's own care instructions instead of the generic blurb when set", () => {
    const withCare = {
      ...product,
      characteristics: [{
        key: "care_instructions",
        label: "Care instructions",
        group: "Care & fulfilment",
        valueType: "TEXT" as const,
        textValue: "Wipe with a soft cloth. Avoid water.",
        numberValue: null,
        booleanValue: null,
        unit: null,
        certificateUrl: null,
        sortOrder: 0,
      }],
    } as ProductSummary;

    render(<ProductPurchasePanel product={withCare} />);

    expect(screen.getByText("Wipe with a soft cloth. Avoid water.")).toBeInTheDocument();
    expect(screen.queryByText(/Care guidance is included with every piece/)).not.toBeInTheDocument();
  });
});
