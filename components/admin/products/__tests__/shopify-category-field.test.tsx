import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
  attributes: vi.fn(),
}));

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: mocks.search,
  getShopifyCategoryAttributesAction: mocks.attributes,
}));

import { ShopifyCategoryField } from "../shopify-category-field";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.attributes.mockResolvedValue({ attributes: [] });
});

describe("ShopifyCategoryField", () => {
  it("preserves an existing Shopify category selection", async () => {
    const { container } = render(
      <ShopifyCategoryField
        initialId="gid://shopify/TaxonomyCategory/aa-1-9"
        initialName="Apparel & Accessories > Jewelry > Rings"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Shopify product category" })).toHaveValue(
      "Apparel & Accessories > Jewelry > Rings",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryId"]')).toHaveValue(
      "gid://shopify/TaxonomyCategory/aa-1-9",
    );
    await waitFor(() => expect(mocks.attributes).toHaveBeenCalledWith("gid://shopify/TaxonomyCategory/aa-1-9"));
  });

  it("searches Shopify and stores the selected category id and full name", async () => {
    mocks.search.mockResolvedValue({
      categories: [
        {
          id: "gid://shopify/TaxonomyCategory/aa-1-9",
          name: "Rings",
          fullName: "Apparel & Accessories > Jewelry > Rings",
        },
      ],
    });
    const user = userEvent.setup();
    const { container } = render(<ShopifyCategoryField initialId="" initialName="" />);

    await user.type(screen.getByRole("combobox"), "rings");
    await waitFor(() => expect(mocks.search).toHaveBeenCalledWith("rings"));
    await user.click(await screen.findByRole("option", { name: /Rings/ }));

    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryId"]')).toHaveValue(
      "gid://shopify/TaxonomyCategory/aa-1-9",
    );
    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryName"]')).toHaveValue(
      "Apparel & Accessories > Jewelry > Rings",
    );
  });

  it("clears both stored values when the category is cleared", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <ShopifyCategoryField
        initialId="gid://shopify/TaxonomyCategory/aa-1-9"
        initialName="Rings"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Clear field" }));

    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryId"]')).toHaveValue("");
    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryName"]')).toHaveValue("");
  });

  it("shows selected Shopify category attribute values, not the vocabulary dump", async () => {
    mocks.attributes.mockResolvedValue({
      attributes: [
        { id: "gid://shopify/TaxonomyAttribute/1", name: "Material" },
        { id: "gid://shopify/TaxonomyAttribute/2", name: "Pattern" },
      ],
    });

    render(
      <ShopifyCategoryField
        initialId="gid://shopify/TaxonomyCategory/aa-1-9"
        initialName="Rings"
        selectedAttributeValues={[
          { key: "material", label: "Material", values: ["Gold"] },
        ]}
      />,
    );

    await waitFor(() => expect(mocks.attributes).toHaveBeenCalledWith("gid://shopify/TaxonomyCategory/aa-1-9"));
    expect(await screen.findByText("Material")).toBeInTheDocument();
    expect(screen.getByText("Gold")).toBeInTheDocument();
    expect(screen.getByText(/Expected by this category but not set on the product: Pattern/)).toBeInTheDocument();
    expect(screen.queryByText(/Gold, Silver/)).not.toBeInTheDocument();
  });
});
