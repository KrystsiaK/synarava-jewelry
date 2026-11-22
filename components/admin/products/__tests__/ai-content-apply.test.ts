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
    const next = applyAiSelectionsToDraft(
      base,
      draft,
      new Set([selectionKey("en", "description"), selectionKey("pt", "title")]),
    );
    expect(next.name).toBe("Keep Me");
    expect(next.description).toBe("<p>EN desc</p>");
    expect(next.seoTitle).toBe("");
    expect(next.translations.pt.title).toBe("Anel PT");
    expect(next.translations.pt.description).toBe("");
  });

  it("formats usage for the modal footer", () => {
    expect(formatUsageLine(makeDraft().usage)).toContain("gemini-test");
    expect(formatUsageLine(makeDraft().usage)).toContain("10+20 tok");
    expect(formatUsageLine(makeDraft().usage)).toContain("$0.0012");
  });

  it("exposes en/pt/ru locales", () => {
    expect([...AI_LOCALES]).toEqual(["en", "pt", "ru"]);
  });
});
