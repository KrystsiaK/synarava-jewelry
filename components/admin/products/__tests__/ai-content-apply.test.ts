import { describe, expect, it } from "vitest";

import {
  AI_LOCALES,
  STALE_APPLY_MESSAGE,
  applyAiSelectionsToDraft,
  buildDefaultSelections,
  defaultFieldChecked,
  formatUsageLine,
  isAiDraftStale,
  isEnTitle,
  selectionKey,
} from "@/components/admin/products/ai-content-apply";
import type { ProductContentDraft } from "@/lib/ai/product-content/contract";
import type { ProductDraft } from "@/components/admin/products/product-types";

function makeDraft(overrides: Partial<ProductContentDraft> = {}): ProductContentDraft {
  return {
    productId: "p1",
    sourceUpdatedAt: "2026-11-21T10:00:00.000Z",
    locales: {
      en: {
        description: "<p>EN desc</p>",
        seoTitle: "EN SEO",
        seoDescription: "EN SEO desc",
      },
      pt: {
        title: "Anel PT",
        description: "<p>PT desc</p>",
        seoTitle: "PT SEO",
      },
    },
    warnings: [{ locale: "pt", field: "seoTitle", message: "SEO title is long" }],
    usage: {
      model: "gemini-test",
      inputTokens: 10,
      outputTokens: 20,
      costUsd: 0.0012,
      latencyMs: 320,
    },
    ...overrides,
  };
}

function emptyProductDraft(): ProductDraft {
  return {
    name: "Lava Ring",
    vendor: "",
    productType: "",
    slug: "lava-ring",
    sku: "LAVA-1",
    price: "45.00",
    compareAt: "",
    taxable: true,
    cost: "",
    shopifyCost: "",
    seriesLabel: "",
    shortDescription: "",
    description: "",
    seoTitle: "",
    seoDescription: "",
    materialLine: "",
    symbolismLabel: "",
    symbolismTitle: "",
    symbolismBody: "",
    symbolismBody2: "",
    shopifyCategoryId: "",
    shopifyCategoryName: "",
    collectionSlug: "",
    tags: "",
    workflowState: "DRAFT",
    imageUrl: "",
    stockOnHand: "0",
    details: {
      attributes: [],
      characteristics: {},
      materialsEyebrow: "",
      materialsTitle: "",
      materials: [],
      process: { eyebrow: "", title: "", stats: [] },
      lookbookEyebrow: "",
      lookbookTitle: "",
      lookbook: [],
    },
    enSpecs: {},
    specOverlays: { pt: {} },
    translations: {
      pt: {
        localizedHandle: "",
        title: "",
        shortDescription: "",
        description: "",
        materialLine: "",
        symbolismLabel: "",
        symbolismTitle: "",
        symbolismBody: "",
        symbolismBody2: "",
        seoTitle: "",
        seoDescription: "",
        details: {
          attributes: [],
          characteristics: {},
          materialsEyebrow: "",
          materialsTitle: "",
          materials: [],
          process: { eyebrow: "", title: "", stats: [] },
          lookbookEyebrow: "",
          lookbookTitle: "",
          lookbook: [],
        },
        reviewed: false,
        syncStatus: "NOT_APPLICABLE",
        syncError: "",
      },
    },
  };
}

describe("ai-content-apply", () => {
  it("never treats EN title as applicable", () => {
    expect(isEnTitle("en", "title")).toBe(true);
    expect(isEnTitle("pt", "title")).toBe(false);
    expect(defaultFieldChecked({
      locale: "en",
      field: "title",
      current: "",
      proposed: "Nope",
      hasWarning: false,
    })).toBe(false);
  });

  it("defaults: empty current checked, non-empty unchecked, warnings unchecked", () => {
    expect(defaultFieldChecked({
      locale: "en",
      field: "description",
      current: "",
      proposed: "<p>x</p>",
      hasWarning: false,
    })).toBe(true);
    expect(defaultFieldChecked({
      locale: "en",
      field: "description",
      current: "existing",
      proposed: "<p>x</p>",
      hasWarning: false,
    })).toBe(false);
    expect(defaultFieldChecked({
      locale: "pt",
      field: "seoTitle",
      current: "",
      proposed: "long",
      hasWarning: true,
    })).toBe(false);
  });

  it("buildDefaultSelections skips filled fields and warning fields", () => {
    const draft = makeDraft();
    const selected = buildDefaultSelections(draft, (locale, field) => {
      if (locale === "en" && field === "description") return "already here";
      return "";
    });
    expect(selected.has(selectionKey("en", "description"))).toBe(false);
    expect(selected.has(selectionKey("en", "seoTitle"))).toBe(true);
    expect(selected.has(selectionKey("pt", "title"))).toBe(true);
    expect(selected.has(selectionKey("pt", "seoTitle"))).toBe(false);
    expect(selected.has(selectionKey("en", "title"))).toBe(false);
  });

  it("stale when updatedAt or source fingerprint drifts", () => {
    expect(isAiDraftStale({
      productUpdatedAt: "2026-11-21T10:00:00.000Z",
      draftSourceUpdatedAt: "2026-11-21T10:00:00.000Z",
      fingerprintAtGenerate: "a",
      fingerprintNow: "a",
    })).toBe(false);
    expect(isAiDraftStale({
      productUpdatedAt: "2026-11-21T11:00:00.000Z",
      draftSourceUpdatedAt: "2026-11-21T10:00:00.000Z",
      fingerprintAtGenerate: "a",
      fingerprintNow: "a",
    })).toBe(true);
    expect(isAiDraftStale({
      productUpdatedAt: "2026-11-21T10:00:00.000Z",
      draftSourceUpdatedAt: "2026-11-21T10:00:00.000Z",
      fingerprintAtGenerate: "a",
      fingerprintNow: "b",
    })).toBe(true);
    expect(STALE_APPLY_MESSAGE).toContain("сгенерируйте");
  });

  it("apply never writes EN title and only merges selected fields", () => {
    const base = emptyProductDraft();
    base.name = "Keep Me";
    base.description = "old";
    const draft = makeDraft();
    const result = applyAiSelectionsToDraft(
      base,
      draft,
      new Set([selectionKey("en", "description"), selectionKey("pt", "title")]),
    );
    expect(result.draft.name).toBe("Keep Me");
    expect(result.draft.description).toBe("<p>EN desc</p>");
    expect(result.draft.seoTitle).toBe("");
    expect(result.draft.translations.pt.title).toBe("Anel PT");
    expect(result.draft.translations.pt.description).toBe("");
    expect(result.failed).toEqual([]);
    expect(result.applied).toEqual(
      expect.arrayContaining([
        selectionKey("en", "description"),
        selectionKey("pt", "title"),
      ]),
    );
  });

  it("creates missing PT/RU translations from emptyLocaleDraft instead of silently skipping", () => {
    const base = emptyProductDraft();
    base.translations = {};
    const draft = makeDraft({
      locales: {
        en: { description: "<p>EN desc</p>", seoTitle: "EN SEO" },
        pt: { title: "Anel PT", description: "<p>PT desc</p>", seoTitle: "PT SEO" },
        ru: { title: "Кольцо RU", seoTitle: "RU SEO" },
      },
    });
    const selected = new Set([
      selectionKey("en", "description"),
      selectionKey("pt", "title"),
      selectionKey("pt", "description"),
      selectionKey("ru", "title"),
      selectionKey("ru", "seoTitle"),
    ]);
    const result = applyAiSelectionsToDraft(base, draft, selected);
    expect(result.failed).toEqual([]);
    expect(result.draft.description).toBe("<p>EN desc</p>");
    expect(result.draft.translations.pt).toBeDefined();
    expect(result.draft.translations.pt.title).toBe("Anel PT");
    expect(result.draft.translations.pt.description).toBe("<p>PT desc</p>");
    expect(result.draft.translations.ru).toBeDefined();
    expect(result.draft.translations.ru.title).toBe("Кольцо RU");
    expect(result.draft.translations.ru.seoTitle).toBe("RU SEO");
    // emptyLocaleDraft shape — not an invented partial
    expect(result.draft.translations.pt).toMatchObject({
      localizedHandle: "",
      materialLine: "",
      reviewed: false,
      syncStatus: "NOT_APPLICABLE",
    });
  });

  it("reports selected fields that could not be applied", () => {
    const base = emptyProductDraft();
    const draft = makeDraft({
      locales: {
        en: { description: "<p>EN</p>" },
        pt: { title: "Anel" },
      },
    });
    const result = applyAiSelectionsToDraft(
      base,
      draft,
      new Set([
        selectionKey("en", "description"),
        selectionKey("pt", "seoTitle"), // selected but no proposed value
        selectionKey("ru", "title"), // selected but no proposed value
      ]),
    );
    expect(result.applied).toEqual([selectionKey("en", "description")]);
    expect(result.failed).toEqual(
      expect.arrayContaining([
        selectionKey("pt", "seoTitle"),
        selectionKey("ru", "title"),
      ]),
    );
  });

  it("formats usage for the modal footer", () => {
    expect(formatUsageLine(makeDraft().usage)).toContain("gemini-test");
    expect(formatUsageLine(makeDraft().usage)).toContain("10+20 tok");
    expect(formatUsageLine(makeDraft().usage)).toContain("$0.0012");
  });

  it("exposes en/pt/ru locales", () => {
    expect([...AI_LOCALES]).toEqual(["en", "pt", "ru"]);
  });

  it("apply writes materialLine, details, and Shopify spec overlays into the form draft", () => {
    const base = emptyProductDraft();
    base.translations = {};
    const materialKey = "customMetafieldValue:custom:material";
    const draft = makeDraft({
      locales: {
        pt: {
          materialLine: "Prata 925",
          materialsEyebrow: "Materiais",
          materialTitle1: "Lava",
          materialBody1: "<p>Corpo</p>",
          [materialKey]: "Prata",
        },
        ru: {
          materialLine: "Серебро 925",
          materialsEyebrow: "Материалы",
          materialTitle1: "Лава",
          [materialKey]: "Серебро",
        },
      },
    });
    const selected = new Set([
      selectionKey("pt", "materialLine"),
      selectionKey("pt", "materialsEyebrow"),
      selectionKey("pt", "materialTitle1"),
      selectionKey("pt", "materialBody1"),
      selectionKey("pt", materialKey),
      selectionKey("ru", "materialLine"),
      selectionKey("ru", "materialsEyebrow"),
      selectionKey("ru", "materialTitle1"),
      selectionKey("ru", materialKey),
    ]);
    const result = applyAiSelectionsToDraft(base, draft, selected);
    expect(result.failed).toEqual([]);
    expect(result.draft.translations.pt.materialLine).toBe("Prata 925");
    expect(result.draft.translations.pt.details.materialsEyebrow).toBe("Materiais");
    expect(result.draft.translations.pt.details.materials[0]?.title).toBe("Lava");
    expect(result.draft.translations.pt.details.materials[0]?.body).toBe("<p>Corpo</p>");
    expect(result.draft.specOverlays.pt.material).toBe("Prata");
    expect(result.draft.translations.ru.materialLine).toBe("Серебро 925");
    expect(result.draft.translations.ru.details.materialsEyebrow).toBe("Материалы");
    expect(result.draft.specOverlays.ru.material).toBe("Серебро");
  });
});
