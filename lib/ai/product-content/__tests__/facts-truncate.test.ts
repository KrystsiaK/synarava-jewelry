import { afterEach, describe, expect, it } from "vitest";

import type { ProductContentFacts } from "@/lib/ai/product-content/facts";
import {
  measureFactsChars,
  truncateAtParagraphBoundary,
  truncateFactsForPrompt,
} from "@/lib/ai/product-content/facts";

const base: ProductContentFacts = {
  productId: "p1",
  name: "River Brooch",
  productType: "Brooch",
  materialLine: "18K gold PVD",
  shortDescription: "Quiet gold form.",
  description: "<p>First paragraph.</p>\n\n<p>Second paragraph with more detail.</p>",
  seoTitle: "River Brooch",
  seoDescription: "Quiet gold.",
  symbolismLabel: null,
  symbolismTitle: null,
  symbolismBody: null,
  symbolismBody2: null,
  enSourceByField: {
    title: "River Brooch",
    shortDescription: "Quiet gold form.",
    description: "<p>First paragraph.</p>",
    materialLine: "18K gold PVD",
    seoTitle: "River Brooch",
    seoDescription: "Quiet gold.",
  },
  detailsAttributes: [{ label: "Finish", value: "18K gold PVD" }],
  characteristics: [{ key: "material", label: "Material", value: "18K gold PVD" }],
  collections: ["Quiet Forms"],
  translations: [],
};

afterEach(() => {
  delete process.env.AI_MAX_INPUT_CHARS;
});

describe("truncateFactsForPrompt", () => {
  it("passes through when under the limit", () => {
    const result = truncateFactsForPrompt(base, 50_000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.truncated).toBe(false);
      expect(result.facts.name).toBe("River Brooch");
    }
  });

  it("truncates long fields and sets truncated=true", () => {
    const longDesc = Array.from({ length: 80 }, (_, i) => `Paragraph ${i}. Detail.\n\n`).join("");
    const fat: ProductContentFacts = {
      ...base,
      description: longDesc,
      shortDescription: "x".repeat(2000),
      translations: Array.from({ length: 20 }, (_, i) => ({
        locale: "pt",
        title: `T${i}`,
        shortDescription: "y".repeat(500),
        description: "z".repeat(500),
        materialLine: null,
        seoTitle: null,
        seoDescription: null,
      })),
    };
    const result = truncateFactsForPrompt(fat, 2_000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.truncated).toBe(true);
      expect(result.inputChars).toBeLessThanOrEqual(2_000);
      expect(result.facts.name).toBe("River Brooch");
      expect(result.facts.characteristics.length).toBeGreaterThan(0);
    }
  });

  it("returns invalid when name+characteristics alone exceed the budget", () => {
    const huge: ProductContentFacts = {
      ...base,
      name: "N".repeat(5_000),
      characteristics: Array.from({ length: 50 }, (_, i) => ({
        key: `k${i}`,
        label: `L${i}`,
        value: "V".repeat(500),
      })),
    };
    const result = truncateFactsForPrompt(huge, 200);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/AI_MAX_INPUT_CHARS/i);
    }
  });

  it("truncateAtParagraphBoundary prefers paragraph breaks", () => {
    const text = "Alpha paragraph.\n\nBeta paragraph continues here.";
    const out = truncateAtParagraphBoundary(text, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out).toMatch(/Alpha/);
  });

  it("measureFactsChars matches JSON length", () => {
    expect(measureFactsChars(base)).toBe(JSON.stringify(base).length);
  });
});
