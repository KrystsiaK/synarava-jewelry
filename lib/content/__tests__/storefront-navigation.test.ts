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
  it("uses the requested locale for collection filter labels", async () => {
    mocks.findManyCollection.mockResolvedValueOnce([{
      slug: "archive", name: "Archive", description: null, manifesto: null,
      symbolismLabel: null, symbolismTitle: null, symbolismBody: null, symbolismBody2: null,
      searchSummary: null, seoTitle: null, seoDescription: null,
      translations: [{ locale: "pt", name: "Arquivo" }],
    }]);
    mocks.findManyProduct.mockResolvedValue([]);
    mocks.findManyTag.mockResolvedValue([]);
    mocks.findManyCharacteristic.mockResolvedValue([]);

    await expect(getShopFilterData("pt")).resolves.toMatchObject({
      collections: [{ slug: "archive", name: "Arquivo" }],
    });
  });
});
