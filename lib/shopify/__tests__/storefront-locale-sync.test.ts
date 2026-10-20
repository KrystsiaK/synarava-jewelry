import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  update: vi.fn(),
  fetchShopifyLocales: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { storefrontLocale: { findMany: mocks.findMany, update: mocks.update } },
}));

vi.mock("../admin", () => ({
  fetchShopifyLocales: mocks.fetchShopifyLocales,
}));

import { syncStorefrontLocalesFromShopify } from "@/lib/shopify/storefront-locale-sync";

const enRow = {
  id: "1",
  code: "en",
  routeSegment: "en",
  shopifyLocale: "en",
  status: "PUBLISHED",
  isPublished: true,
  retiredAt: null,
  deletedAt: null,
};
const ptRow = {
  id: "2",
  code: "pt",
  routeSegment: "pt",
  shopifyLocale: "pt-PT",
  status: "PUBLISHED",
  isPublished: true,
  retiredAt: null,
  deletedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.update.mockResolvedValue({});
});

describe("syncStorefrontLocalesFromShopify", () => {
  it("refreshes publication state for matched locales without touching routeSegment", async () => {
    mocks.findMany.mockResolvedValue([enRow, ptRow]);
    mocks.fetchShopifyLocales.mockResolvedValue([
      { locale: "en", name: "English", primary: true, published: true },
      { locale: "pt-PT", name: "Portuguese (Portugal)", primary: false, published: true },
    ]);

    const result = await syncStorefrontLocalesFromShopify();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "1" },
      data: {
        status: "PUBLISHED",
        isPublished: true,
        retiredAt: null,
        shopifyUpdatedAt: expect.any(Date),
      },
    });
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "2" },
      data: {
        status: "PUBLISHED",
        isPublished: true,
        retiredAt: null,
        shopifyUpdatedAt: expect.any(Date),
      },
    });
    expect(result.updated).toEqual([
      { code: "en", shopifyLocale: "en", isPublished: true },
      { code: "pt", shopifyLocale: "pt-PT", isPublished: true },
    ]);
    expect(result.orphaned).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });

  it("matches locale codes case-insensitively", async () => {
    mocks.findMany.mockResolvedValue([{ ...ptRow, status: "DRAFT", isPublished: false }]);
    mocks.fetchShopifyLocales.mockResolvedValue([
      { locale: "PT-pt", name: "Portuguese", primary: false, published: false },
    ]);

    const result = await syncStorefrontLocalesFromShopify();

    expect(result.updated).toEqual([{ code: "pt", shopifyLocale: "pt-PT", isPublished: false }]);
  });

  it("reports a Shopify locale with no registry row as unmatched, without creating one", async () => {
    mocks.findMany.mockResolvedValue([enRow]);
    mocks.fetchShopifyLocales.mockResolvedValue([
      { locale: "en", name: "English", primary: true, published: true },
      { locale: "ru", name: "Russian", primary: false, published: true },
    ]);

    const result = await syncStorefrontLocalesFromShopify();

    expect(result.unmatched).toEqual([{ locale: "ru", name: "Russian", primary: false, published: true }]);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("marks a registry row unpublished and orphaned when Shopify no longer reports its locale", async () => {
    mocks.findMany.mockResolvedValue([ptRow]);
    mocks.fetchShopifyLocales.mockResolvedValue([
      { locale: "en", name: "English", primary: true, published: true },
    ]);

    const result = await syncStorefrontLocalesFromShopify();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "2" },
      data: {
        status: "DRAFT",
        isPublished: false,
        retiredAt: null,
        shopifyUpdatedAt: expect.any(Date),
      },
    });
    expect(result.orphaned).toEqual([{ code: "pt", shopifyLocale: "pt-PT" }]);
  });

  it("leaves Retired rows retired when Shopify reports unpublished", async () => {
    mocks.findMany.mockResolvedValue([
      {
        ...ptRow,
        status: "RETIRED",
        isPublished: false,
        retiredAt: new Date("2026-09-01T00:00:00.000Z"),
      },
    ]);
    mocks.fetchShopifyLocales.mockResolvedValue([
      { locale: "pt-PT", name: "Portuguese", primary: false, published: false },
    ]);

    await syncStorefrontLocalesFromShopify();

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "2" },
      data: {
        status: "RETIRED",
        isPublished: false,
        retiredAt: new Date("2026-09-01T00:00:00.000Z"),
        shopifyUpdatedAt: expect.any(Date),
      },
    });
  });

  it("skips Deleted rows without rewriting status", async () => {
    mocks.findMany.mockResolvedValue([
      { ...ptRow, status: "RETIRED", isPublished: false, deletedAt: new Date() },
    ]);
    mocks.fetchShopifyLocales.mockResolvedValue([]);

    const result = await syncStorefrontLocalesFromShopify();

    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.updated).toEqual([{ code: "pt", shopifyLocale: "pt-PT", isPublished: false }]);
    expect(result.orphaned).toEqual([{ code: "pt", shopifyLocale: "pt-PT" }]);
  });
});
