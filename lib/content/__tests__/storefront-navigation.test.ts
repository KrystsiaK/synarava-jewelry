const mocks = vi.hoisted(() => ({
  findManyCollection: vi.fn(),
  findManyProduct: vi.fn(),
  findManyTag: vi.fn(),
  findManyCharacteristic: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    collection: { findMany: mocks.findManyCollection },
    product: { findMany: mocks.findManyProduct },
    tag: { findMany: mocks.findManyTag },
    productCharacteristic: { findMany: mocks.findManyCharacteristic },
  },
}));

import { getShopFilterData } from "@/lib/content/catalog";

describe("getShopFilterData locale", () => {
  beforeEach(() => {
    mocks.findManyCollection.mockReset();
    mocks.findManyProduct.mockReset();
    mocks.findManyTag.mockReset();
    mocks.findManyCharacteristic.mockReset();
  });

  it("uses the requested locale for collection filter labels", async () => {
    mocks.findManyCollection.mockResolvedValueOnce([{
      slug: "archive", name: "Archive", description: null, manifesto: null,
      symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null,
      searchSummary: null, seoTitle: null, seoDescription: null,
      translations: [{ locale: "pt", name: "Arquivo" }],
    }]);
    mocks.findManyProduct.mockResolvedValue([]);
    mocks.findManyCharacteristic.mockResolvedValue([]);

    await expect(getShopFilterData("pt")).resolves.toMatchObject({
      collections: [{ slug: "archive", name: "Arquivo" }],
    });
  });

  it("localizes category leaf and product-type facet values for RU", async () => {
    mocks.findManyCollection.mockResolvedValueOnce([]);
    mocks.findManyProduct
      .mockResolvedValueOnce([{
        shopifyCategoryId: "gid://shopify/TaxonomyCategory/aa-1-13-1",
        shopifyCategoryName: "Apparel & Accessories > Jewelry > Brooches",
      }])
      .mockResolvedValueOnce([{ productType: "Brooches" }]);
    mocks.findManyCharacteristic
      .mockResolvedValueOnce([
        { key: "material", textValue: "Pearl" },
        { key: "finish", textValue: "18K Gold PVD" },
      ])
      .mockResolvedValueOnce([
        {
          key: "material",
          textValue: "Pearl",
          product: { translations: [{ details: { characteristics: { material: "Речной жемчуг" } } }] },
        },
        {
          key: "finish",
          textValue: "18K Gold PVD",
          product: { translations: [{ details: null }] },
        },
      ]);

    await expect(getShopFilterData("ru")).resolves.toMatchObject({
      categories: [{ slug: "gid://shopify/TaxonomyCategory/aa-1-13-1", name: "Броши" }],
      productTypes: [{ slug: "Brooches", name: "Броши" }],
      tags: [],
      materials: [{ slug: "Pearl", name: "Речной жемчуг" }],
      finishes: [{ slug: "18K Gold PVD", name: "PVD золото 18K" }],
    });
    expect(mocks.findManyTag).not.toHaveBeenCalled();
  });
});
