import { resolveShopStorefrontCopy } from "@/lib/content/shop-page-copy";

const dictionary: Record<string, string> = {
  "shop.discovery.newTitle": "New arrivals",
  "shop.discovery.newDescription": "The latest pieces.",
  "shop.discovery.viewAll": "View all",
  "shop.discovery.productTypeTitle": "Shop by product type",
  "shop.discovery.productTypeDescription": "Find what you are looking for",
  "shop.filters.eyebrow": "Find the right product",
  "shop.filters.description": "Filter the selection.",
  "shop.filters.category": "Category",
  "shop.filters.productType": "Product type",
  "shop.filters.availability": "Availability",
  "shop.filters.more": "More filters",
  "shop.filters.searchPlaceholder": "Search products",
  "shop.filters.searchLabel": "Search products",
  "shop.filters.showing": "Showing",
};

const t = (key: string) => dictionary[key] ?? key;

describe("resolveShopStorefrontCopy", () => {
  it("uses the locale dictionary when the admin field is empty", () => {
    expect(resolveShopStorefrontCopy({ shopNewTitle: "  " }, t, "products available")).toMatchObject({
      newTitle: "New arrivals",
      availableCountLabel: "products available",
    });
  });

  it("prefers the saved locale value over the dictionary", () => {
    const copy = resolveShopStorefrontCopy({
      shopNewTitle: "Novidades",
      shopFiltersSearchPlaceholder: "Pesquisar",
      shopAvailableCountLabel: "produtos disponíveis",
    }, t, "products available");

    expect(copy.newTitle).toBe("Novidades");
    expect(copy.filters.searchPlaceholder).toBe("Pesquisar");
    expect(copy.filters.searchLabel).toBe("Pesquisar");
    expect(copy.availableCountLabel).toBe("produtos disponíveis");
    expect(copy.filters.category).toBe("Category");
  });
});
