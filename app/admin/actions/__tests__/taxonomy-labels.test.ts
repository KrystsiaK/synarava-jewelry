import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  listCatalogTaxonomyEnValues: vi.fn(),
  listTaxonomyValueLabels: vi.fn(),
  getStorefrontLocales: vi.fn(),
  saveSynaravaTaxonomyLabels: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/auth/admin-session", () => ({
  requireAdminSession: mocks.requireAdminSession,
}));

vi.mock("@/lib/catalog/taxonomy-value-labels", () => ({
  listCatalogTaxonomyEnValues: mocks.listCatalogTaxonomyEnValues,
  listTaxonomyValueLabels: mocks.listTaxonomyValueLabels,
  saveSynaravaTaxonomyLabels: mocks.saveSynaravaTaxonomyLabels,
}));

vi.mock("@/lib/i18n/storefront-locale-cache", () => ({
  getStorefrontLocales: mocks.getStorefrontLocales,
}));

import {
  taxonomyDictionaryLabel,
  taxonomyLabelDivergence,
} from "@/lib/catalog/taxonomy-label-divergence";

import { loadTaxonomyLabelsEditorPayload } from "../taxonomy-labels";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdminSession.mockResolvedValue({ user: { id: "admin" } });
  mocks.getStorefrontLocales.mockResolvedValue([
    { code: "en", label: "English" },
    { code: "pt", label: "Português" },
    { code: "ru", label: "Русский" },
  ]);
  mocks.listCatalogTaxonomyEnValues.mockResolvedValue({
    categoryLeaves: [],
    productTypes: ["Bag Charm", "Necklaces"],
  });
});

describe("taxonomyLabelDivergence (lib helper)", () => {
  it("flags when the saved label differs from the code dictionary", () => {
    expect(taxonomyDictionaryLabel("Bag Charm", "pt")).toBe("Charm para mala");
    expect(taxonomyLabelDivergence("Bag Charm", "pt", "artefacto")).toEqual({
      divergesFromDictionary: true,
      dictionaryLabel: "Charm para mala",
    });
  });

  it("does not flag when the saved label matches the code dictionary", () => {
    expect(taxonomyLabelDivergence("Necklaces", "pt", "Colares")).toBeUndefined();
  });
});

describe("loadTaxonomyLabelsEditorPayload divergence", () => {
  it("flags a row when the saved label differs from the code dictionary", async () => {
    mocks.listTaxonomyValueLabels.mockResolvedValue([
      {
        id: "1",
        kind: "PRODUCT_TYPE",
        enValue: "Bag Charm",
        locale: "pt",
        label: "artefacto",
        source: "SYNARAVA",
      },
      {
        id: "2",
        kind: "PRODUCT_TYPE",
        enValue: "Necklaces",
        locale: "pt",
        label: "Colares",
        source: "SEED_MAP",
      },
    ]);

    const payload = await loadTaxonomyLabelsEditorPayload();

    expect(payload.sources.pt.PRODUCT_TYPE["Bag Charm"]).toBe("SYNARAVA");
    expect(payload.divergences.pt.PRODUCT_TYPE["Bag Charm"]).toEqual({
      divergesFromDictionary: true,
      dictionaryLabel: "Charm para mala",
    });
    expect(payload.divergences.pt.PRODUCT_TYPE["Necklaces"]).toBeUndefined();
  });

  it("does not flag a row when the saved label matches the code dictionary", async () => {
    mocks.listTaxonomyValueLabels.mockResolvedValue([
      {
        id: "2",
        kind: "PRODUCT_TYPE",
        enValue: "Necklaces",
        locale: "pt",
        label: "Colares",
        source: "SEED_MAP",
      },
    ]);

    const payload = await loadTaxonomyLabelsEditorPayload();

    expect(payload.labels.pt.PRODUCT_TYPE.Necklaces).toBe("Colares");
    expect(payload.divergences).toEqual(expect.any(Object));
    expect(payload.divergences.pt?.PRODUCT_TYPE?.Necklaces).toBeUndefined();
  });
});
