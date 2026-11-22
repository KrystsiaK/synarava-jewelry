import { describe, expect, it } from "vitest";

import type { ProductContentFacts } from "@/lib/ai/product-content/facts";
import {
  normalizeClaimText,
  validateAndNormalizeDraftLocales,
} from "@/lib/ai/product-content/validate";

const baseFacts: ProductContentFacts = {
  productId: "p1",
  name: "River Pearl Ring",
  productType: "Ring",
  materialLine: "925 sterling silver",
  shortDescription: null,
  description: null,
  seoTitle: null,
  seoDescription: null,
  detailsAttributes: [],
  characteristics: [{ key: "material", label: "Material", value: "925 sterling silver" }],
  collections: ["Quiet Forms"],
  translations: [],
};

describe("validateAndNormalizeDraftLocales", () => {
  it("returns null for garbage JSON", () => {
    expect(validateAndNormalizeDraftLocales("{not-json", baseFacts, ["en"])).toBeNull();
  });

  it("strips en.title and keeps other en fields", () => {
    const raw = JSON.stringify({
      locales: {
        en: {
          title: "Should never appear",
          shortDescription: "A quiet ring.",
          seoTitle: "River Pearl Ring",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result).not.toBeNull();
    expect(result!.locales.en?.title).toBeUndefined();
    expect(result!.locales.en?.shortDescription).toBe("A quiet ring.");
  });

  it("clamps seo lengths and sanitizes description HTML", () => {
    const raw = JSON.stringify({
      locales: {
        en: {
          seoTitle: "x".repeat(80),
          seoDescription: "y".repeat(200),
          description:
            "<p>First line with <strong>emphasis</strong>.</p><p>Second paragraph.</p><script>alert(1)</script>",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.locales.en?.seoTitle?.length).toBeLessThanOrEqual(60);
    expect(result!.locales.en?.seoDescription?.length).toBeLessThanOrEqual(160);
    expect(result!.locales.en?.description).not.toMatch(/script/i);
    expect(result!.locales.en?.description).toMatch(/<strong>/i);
    expect(result!.locales.en?.description).toMatch(/<p>/i);
  });

  it("warns when hypoallergenic is invented", () => {
    const raw = JSON.stringify({
      locales: {
        en: {
          shortDescription: "Hypoallergenic everyday ring.",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /hypoallergenic/i.test(w.message))).toBe(true);
  });

  it("does not warn when silver claim is present in facts", () => {
    const raw = JSON.stringify({
      locales: {
        en: {
          shortDescription: "Crafted in silver for quiet wear.",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /silver/i.test(w.message))).toBe(false);
  });

  it("warns for silver when facts only have silver-plated compound", () => {
    const platedFacts: ProductContentFacts = {
      ...baseFacts,
      materialLine: "silver-plated brass",
      characteristics: [
        { key: "material", label: "Material", value: "silver-plated brass" },
      ],
    };
    const raw = JSON.stringify({
      locales: {
        en: {
          shortDescription: "Solid silver band.",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, platedFacts, ["en"]);
    expect(result!.warnings.some((w) => /silver/i.test(w.message))).toBe(true);
  });

  it("2a: warns empty locale output", () => {
    const raw = JSON.stringify({ locales: { en: { shortDescription: "  " } } });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /empty locale output/i.test(w.message))).toBe(true);
  });

  it("2b: warns RU foreign latin not in facts", () => {
    const raw = JSON.stringify({
      locales: {
        ru: { shortDescription: "Кольцо with brooch details" },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["ru"]);
    expect(result!.warnings.some((w) => /RU foreign latin/i.test(w.message))).toBe(true);
  });

  it("2c: warns test-source leakage", () => {
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "lorem ipsum quiet ring" },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /test-source/i.test(w.message))).toBe(true);
  });

  it("2d: warns unsupported numbers not in facts", () => {
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "Sized at 17 mm for quiet wear." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /unsupported number/i.test(w.message))).toBe(true);
  });

  it("3: brooch with 18K gold PVD in facts → 0 gold warnings", () => {
    const broochFacts: ProductContentFacts = {
      ...baseFacts,
      name: "River Brooch",
      productType: "Brooch",
      materialLine: "18K gold PVD",
      characteristics: [
        { key: "material", label: "Material", value: "18K gold PVD" },
      ],
    };
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "Quiet 18k gold brooch with PVD finish." },
        pt: { title: "Broche", shortDescription: "Broche em ouro 18K." },
        ru: { title: "Брошь", shortDescription: "Брошь с золото 18K." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, broochFacts, ["en", "pt", "ru"]);
    expect(result!.warnings.filter((w) => /gold|ouro|золото/i.test(w.message))).toEqual([]);
  });

  it("normalizeClaimText unifies 18K variants", () => {
    expect(normalizeClaimText("18-K Gold")).toContain("18k");
    expect(normalizeClaimText("18 K gold")).toContain("18k");
    expect(normalizeClaimText("18k gold")).toContain("18k");
  });

  it("9: warns cliché phrases", () => {
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "A ring of timeless elegance." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en"]);
    expect(result!.warnings.some((w) => /cliché/i.test(w.message))).toBe(true);
  });
});
