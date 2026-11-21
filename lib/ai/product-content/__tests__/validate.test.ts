import { describe, expect, it } from "vitest";

import type { ProductContentFacts } from "@/lib/ai/product-content/facts";
import { validateAndNormalizeDraftLocales } from "@/lib/ai/product-content/validate";

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
});
