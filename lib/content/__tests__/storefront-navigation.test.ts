const mocks = vi.hoisted(() => ({
  findManyCollection: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { collection: { findMany: mocks.findManyCollection } },
}));

import { getStorefrontNavigation } from "@/lib/content/catalog";

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
});
