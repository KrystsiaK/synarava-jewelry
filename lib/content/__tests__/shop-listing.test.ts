import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany, rows, listBestSellingShopifyProductIds } = vi.hoisted(() => ({
  findMany: vi.fn(),
  rows: [] as unknown[],
  listBestSellingShopifyProductIds: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: { product: { findMany } } }));
vi.mock("@/lib/i18n/server", () => ({ getRequestLocale: () => Promise.resolve("en") }));
vi.mock("@/lib/content/catalog", () => ({ listBestSellingShopifyProductIds }));

import { listShopCatalogPage, listShopListingProducts } from "../shop-listing";

function catalogRow(overrides: {
  id: string;
  slug: string;
  priceCents: number;
  createdAt: Date;
  shopifyProductId?: string | null;
  name?: string;
}) {
  return {
    id: overrides.id,
    slug: overrides.slug,
    sku: `${overrides.id}-SKU`,
    shopifyProductId: overrides.shopifyProductId ?? null,
    name: overrides.name ?? overrides.slug,
    productType: null,
    seriesLabel: null,
    shortDescription: "",
    description: "",
    materialLine: null,
    searchSummary: null,
    searchDocument: null,
    currency: "EUR",
    priceCents: overrides.priceCents,
    imageUrl: "/product.webp",
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    createdAt: overrides.createdAt,
    translations: [],
    variants: [{ status: "ACTIVE", stockOnHand: 5, inventoryPolicy: "DENY", tracked: true, priceCents: overrides.priceCents, compareAtCents: null }],
    tags: [],
    collections: [],
    characteristics: [],
  };
}

describe("shop listing projection", () => {
  beforeEach(() => {
    rows.length = 0;
    findMany.mockImplementation(() => Promise.resolve(rows));
    listBestSellingShopifyProductIds.mockResolvedValue(null);
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
      collections: [{ sortOrder: 0, collection: { slug: "rings", name: "Rings", isStorefrontDefault: false } }],
      characteristics: [{ key: "material", textValue: "silver", booleanValue: null }],
    });

    const products = await listShopListingProducts();
    expect(products[0]).toMatchObject({
      slug: "silver-ring",
      priceAmount: 12,
      compareAtAmount: 15,
      inStock: true,
      categoryName: "Rings",
      collectionSlugs: ["rings"],
    });
    expect(products[0]).not.toHaveProperty("variantDetails");
    expect(products[0]).not.toHaveProperty("commerceMedia");

    const select = findMany.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("details");
    expect(select).not.toHaveProperty("shopifySnapshot");
    expect(select).not.toHaveProperty("media");
    expect(select.variants.select).not.toHaveProperty("selectedOptions");
  });

  it("projects translated product copy when an explicit Portuguese locale is supplied", async () => {
    rows.push({
      slug: "anel", sku: "ANEL-1", shopifyProductId: null, name: "Ring", seriesLabel: null,
      shortDescription: "English", description: "English", materialLine: null,
      searchSummary: null, searchDocument: null, currency: "EUR", priceCents: 1000,
      imageUrl: "/ring.webp", shopifyCategoryId: null, shopifyCategoryName: null,
      createdAt: new Date("2026-01-01"),
      translations: [{ locale: "pt", title: "Anel", shortDescription: "Português", description: "Português", materialLine: null }],
      variants: [{ status: "ACTIVE", stockOnHand: 1, inventoryPolicy: "DENY", tracked: true, priceCents: 1000, compareAtCents: null }],
      tags: [],
      collections: [],
      characteristics: [],
    });

    await expect(listShopListingProducts("pt")).resolves.toMatchObject([{
      title: "Anel",
      shortDescription: "Português",
    }]);
  });
});

describe("listShopCatalogPage", () => {
  beforeEach(() => {
    rows.length = 0;
    findMany.mockImplementation(() => Promise.resolve(rows));
    listBestSellingShopifyProductIds.mockResolvedValue(null);
    rows.push(
      catalogRow({ id: "a", slug: "a", priceCents: 3000, createdAt: new Date("2026-01-03"), shopifyProductId: "gid://shopify/Product/a" }),
      catalogRow({ id: "b", slug: "b", priceCents: 1000, createdAt: new Date("2026-01-02"), shopifyProductId: "gid://shopify/Product/b" }),
      catalogRow({ id: "c", slug: "c", priceCents: 2000, createdAt: new Date("2026-01-01"), shopifyProductId: "gid://shopify/Product/c" }),
    );
  });

  it("paginates a full first page and continues from its cursor", async () => {
    const first = await listShopCatalogPage({ filters: { sort: "newest" }, locale: "en", limit: 2 });
    expect(first.nodes.map((n) => n.id)).toEqual(["a", "b"]);
    expect(first.hasNextPage).toBe(true);
    expect(first.endCursor).not.toBeNull();
    expect(first.totalCount).toBe(3);

    const second = await listShopCatalogPage({ filters: { sort: "newest" }, locale: "en", limit: 2, cursor: first.endCursor });
    expect(second.nodes.map((n) => n.id)).toEqual(["c"]);
    expect(second.hasNextPage).toBe(false);
    expect(second.endCursor).toBeNull();
  });

  it("sorts by listing price, ascending", async () => {
    const page = await listShopCatalogPage({ filters: { sort: "price-asc" }, locale: "en", limit: 10 });
    expect(page.nodes.map((n) => n.id)).toEqual(["b", "c", "a"]);
  });

  it("ignores a cursor minted for a different filter/sort and restarts from the top", async () => {
    const cursorForOtherSort = (await listShopCatalogPage({ filters: { sort: "price-asc" }, locale: "en", limit: 1 })).endCursor;
    const page = await listShopCatalogPage({ filters: { sort: "newest" }, locale: "en", limit: 2, cursor: cursorForOtherSort });
    expect(page.nodes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("orders by Shopify's best-selling rank when sort is popular and it's available", async () => {
    listBestSellingShopifyProductIds.mockResolvedValue(["gid://shopify/Product/c", "gid://shopify/Product/a", "gid://shopify/Product/b"]);
    const page = await listShopCatalogPage({ filters: { sort: "popular" }, locale: "en", limit: 10 });
    expect(page.nodes.map((n) => n.id)).toEqual(["c", "a", "b"]);
    expect(page.popularAvailable).toBe(true);
  });

  it("falls back honestly when Shopify's ranking isn't available", async () => {
    listBestSellingShopifyProductIds.mockResolvedValue(null);
    const page = await listShopCatalogPage({ filters: { sort: "popular" }, locale: "en", limit: 10 });
    expect(page.popularAvailable).toBe(false);
  });
});
