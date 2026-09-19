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

import { getShopFilterData, getStorefrontNavigation } from "@/lib/content/catalog";

describe("getStorefrontNavigation locale", () => {
  it("resolves the Portuguese collection name for a primary-nav department", async () => {
    mocks.findManyCollection.mockResolvedValue([
      {
        slug: "jewelry",
        name: "Jewelry",
        description: null, manifesto: null, symbolismLabel: null, symbolismTitle: null,
        symbolismBody: null, symbolismBody2: null, searchSummary: null, seoTitle: null, seoDescription: null,
        translations: [{ locale: "PT", name: "Joalharia", description: null, manifesto: null, symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null, searchSummary: null, seoTitle: null, seoDescription: null }],
      },
    ]);

    await expect(getStorefrontNavigation("pt")).resolves.toEqual([{ slug: "jewelry", name: "Joalharia" }]);
    await expect(getStorefrontNavigation("en")).resolves.toEqual([{ slug: "jewelry", name: "Jewelry" }]);
  });

  it("defaults to English when no locale is passed", async () => {
    mocks.findManyCollection.mockResolvedValue([
      { slug: "pets", name: "Pets", description: null, manifesto: null, symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null, searchSummary: null, seoTitle: null, seoDescription: null, translations: [] },
    ]);

    await expect(getStorefrontNavigation()).resolves.toEqual([{ slug: "pets", name: "Pets" }]);
  });

  it("uses the requested locale for department and collection filter labels", async () => {
    mocks.findManyCollection
      .mockResolvedValueOnce([{
        slug: "jewelry", name: "Jewelry", description: null, manifesto: null,
        symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null,
        searchSummary: null, seoTitle: null, seoDescription: null,
        translations: [{ locale: "PT", name: "Joalharia" }],
      }])
      .mockResolvedValueOnce([{
        slug: "archive", name: "Archive", description: null, manifesto: null,
        symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null,
        searchSummary: null, seoTitle: null, seoDescription: null,
        translations: [{ locale: "PT", name: "Arquivo" }],
      }]);
    mocks.findManyProduct.mockResolvedValue([]);
    mocks.findManyTag.mockResolvedValue([]);
    mocks.findManyCharacteristic.mockResolvedValue([]);

    await expect(getShopFilterData("pt")).resolves.toMatchObject({
      departments: [{ slug: "jewelry", name: "Joalharia" }],
      collections: [{ slug: "archive", name: "Arquivo" }],
    });
  });
});
