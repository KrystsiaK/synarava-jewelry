import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, rows } = vi.hoisted(() => ({
  findMany: vi.fn(),
  rows: [] as unknown[],
}));
vi.mock("@/lib/db", () => ({ db: { product: { findMany } } }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("en") }));

import { listShopListingProducts } from "../shop-listing";

describe("shop listing projection", () => {
  beforeEach(() => {
    rows.length = 0;
    findMany.mockImplementation(() => Promise.resolve(rows));
  });

  it("queries only listing fields and keeps available variant pricing", async () => {
    rows.push({
      slug: "silver-ring",
      sku: "RING-1",
      shopifyProductId: "gid://shopify/Product/1",
      name: "Silver ring",
      seriesLabel: "Nocturne",
      shortDescription: "Hand finished",
      description: "A long product story",
      materialLine: "Silver",
      searchSummary: "ring",
      searchDocument: "silver ring",
      currency: "EUR",
      priceCents: 1000,
      imageUrl: "/ring.webp",
      shopifyCategoryId: "cat-1",
      shopifyCategoryName: "Jewelry > Rings",
      createdAt: new Date("2026-01-01"),
      translations: [],
      variants: [
        { status: "ACTIVE", stockOnHand: 0, inventoryPolicy: "DENY", tracked: true, priceCents: 1000, compareAtCents: null },
        { status: "ACTIVE", stockOnHand: 2, inventoryPolicy: "DENY", tracked: true, priceCents: 1200, compareAtCents: 1500 },
      ],
      tags: [{ tag: { slug: "gift", name: "Gift" } }],
      collections: [{ sortOrder: 0, collection: { slug: "jewelry", name: "Jewelry", isPrimaryNav: true, isStorefrontDefault: false } }],
      characteristics: [{ key: "material", textValue: "silver", booleanValue: null }],
    });

    const products = await listShopListingProducts();
    expect(products[0]).toMatchObject({
      slug: "silver-ring",
      priceAmount: 12,
      compareAtAmount: 15,
      inStock: true,
      categoryName: "Rings",
      departmentSlug: "jewelry",
    });
    expect(products[0]).not.toHaveProperty("variantDetails");
    expect(products[0]).not.toHaveProperty("commerceMedia");

    const select = findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("details");
    expect(select).not.toHaveProperty("shopifySnapshot");
    expect(select).not.toHaveProperty("media");
    expect(select.variants.select).not.toHaveProperty("selectedOptions");
  });

  it("projects translated department names when an explicit Portuguese locale is supplied", async () => {
    rows.push({
      slug: "anel", sku: "ANEL-1", shopifyProductId: null, name: "Ring", seriesLabel: null,
      shortDescription: "English", description: "English", materialLine: null,
      searchSummary: null, searchDocument: null, currency: "EUR", priceCents: 1000,
      imageUrl: "/ring.webp", shopifyCategoryId: null, shopifyCategoryName: null,
      createdAt: new Date("2026-01-01"),
      translations: [{ title: "Anel", shortDescription: "Português", description: "Português", materialLine: null }],
      variants: [{ status: "ACTIVE", stockOnHand: 1, inventoryPolicy: "DENY", tracked: true, priceCents: 1000, compareAtCents: null }],
      tags: [],
      collections: [{
        sortOrder: 0,
        collection: {
          slug: "jewelry", name: "Jewelry", isPrimaryNav: true, isStorefrontDefault: false,
          translations: [{ locale: "pt", name: "Joalharia" }],
        },
      }],
      characteristics: [],
    });

    await expect(listShopListingProducts("pt")).resolves.toMatchObject([{
      title: "Anel",
      departmentName: "Joalharia",
    }]);
  });
});
