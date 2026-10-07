import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  createMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
  productFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    taxonomyValueLabel: {
      findMany: mocks.findMany,
      createMany: mocks.createMany,
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      delete: mocks.delete,
    },
    product: { findMany: mocks.productFindMany },
  },
}));

import {
  applyShopifyProductTypeLabel,
  ensureTaxonomySeedLabels,
  getTaxonomyFacetLabelMap,
  saveSynaravaTaxonomyLabels,
  taxonomySeedEntries,
} from "../taxonomy-value-labels";

describe("taxonomySeedEntries", () => {
  it("seeds both category leaf and product type for jewelry vocabulary keys", () => {
    const rows = taxonomySeedEntries();
    expect(rows.some((row) => row.kind === "CATEGORY_LEAF" && row.enValue === "Brooches" && row.locale === "ru")).toBe(true);
    expect(rows.some((row) => row.kind === "PRODUCT_TYPE" && row.enValue === "Necklaces" && row.locale === "pt")).toBe(true);
    expect(rows.some((row) => row.enValue === "Pearl")).toBe(false);
  });
});

describe("getTaxonomyFacetLabelMap", () => {
  beforeEach(() => {
    mocks.findMany.mockReset();
  });

  it("prefers SHOPIFY over SYNARAVA over SEED_MAP for the same EN value", async () => {
    mocks.findMany.mockResolvedValueOnce([
      { enValue: "Brooches", label: "Seed", kind: "CATEGORY_LEAF", source: "SEED_MAP" },
      { enValue: "Brooches", label: "Admin", kind: "PRODUCT_TYPE", source: "SYNARAVA" },
      { enValue: "Brooches", label: "Shopify", kind: "PRODUCT_TYPE", source: "SHOPIFY" },
    ]);
    const map = await getTaxonomyFacetLabelMap("ru");
    expect(map.get("Brooches")).toBe("Shopify");
  });
});

describe("ensureTaxonomySeedLabels", () => {
  it("createMany with skipDuplicates", async () => {
    mocks.createMany.mockResolvedValueOnce({ count: 4 });
    await expect(ensureTaxonomySeedLabels()).resolves.toBe(4);
    expect(mocks.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });
});

describe("applyShopifyProductTypeLabel", () => {
  it("upserts PRODUCT_TYPE with SHOPIFY source", async () => {
    mocks.upsert.mockResolvedValueOnce({});
    await applyShopifyProductTypeLabel({
      enProductType: "Brooches",
      locale: "ru",
      label: "Броши",
    });
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ kind: "PRODUCT_TYPE", source: "SHOPIFY", label: "Броши" }),
      update: expect.objectContaining({ source: "SHOPIFY", label: "Броши" }),
    }));
  });
});

describe("saveSynaravaTaxonomyLabels", () => {
  beforeEach(() => {
    mocks.upsert.mockReset();
    mocks.findUnique.mockReset();
    mocks.delete.mockReset();
  });

  it("upserts SYNARAVA labels and skips EN locale", async () => {
    mocks.upsert.mockResolvedValue({});
    const saved = await saveSynaravaTaxonomyLabels([
      { kind: "CATEGORY_LEAF", enValue: "Rings", locale: "en", label: "Кольца" },
      { kind: "CATEGORY_LEAF", enValue: "Rings", locale: "ru", label: "Кольца" },
    ]);
    expect(saved).toBe(1);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
  });
});
