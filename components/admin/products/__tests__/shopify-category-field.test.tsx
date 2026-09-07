import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  search: vi.fn(),
}));

vi.mock("@/app/admin/actions/taxonomy", () => ({
  searchShopifyTaxonomyCategoriesAction: mocks.search,
}));

import { ShopifyCategoryField } from "../shopify-category-field";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ShopifyCategoryField", () => {
  it("preserves an existing Shopify category selection", () => {
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

    await user.click(screen.getByRole("button", { name: "Clear" }));

    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryId"]')).toHaveValue("");
    expect(container.querySelector<HTMLInputElement>('input[name="shopifyCategoryName"]')).toHaveValue("");
  });
});
