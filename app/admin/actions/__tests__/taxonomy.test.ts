import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  searchShopifyTaxonomyCategories: vi.fn(),
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/shopify/taxonomy", () => ({
  searchShopifyTaxonomyCategories: mocks.searchShopifyTaxonomyCategories,
}));

import { searchShopifyTaxonomyCategoriesAction } from "../taxonomy";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("searchShopifyTaxonomyCategoriesAction", () => {
  it("authenticates every request and returns a constrained result", async () => {
    mocks.searchShopifyTaxonomyCategories.mockResolvedValue([
      {
        id: "gid://shopify/TaxonomyCategory/aa-1-9",
        name: "Rings",
        fullName: "Apparel & Accessories > Jewelry > Rings",
      },
    ]);

    await expect(searchShopifyTaxonomyCategoriesAction("rings")).resolves.toEqual({
      categories: [
        {
          id: "gid://shopify/TaxonomyCategory/aa-1-9",
          name: "Rings",
          fullName: "Apparel & Accessories > Jewelry > Rings",
        },
      ],
    });

    expect(mocks.requireAdminSession).toHaveBeenCalledWith("/admin/products");
    expect(mocks.searchShopifyTaxonomyCategories).toHaveBeenCalledWith("rings");
  });

  it("returns a displayable error without leaking an exception object", async () => {
    mocks.searchShopifyTaxonomyCategories.mockRejectedValue(new Error("Shopify unavailable"));

    await expect(searchShopifyTaxonomyCategoriesAction("rings")).resolves.toEqual({
      categories: [],
      error: "Shopify unavailable",
    });
  });
});
