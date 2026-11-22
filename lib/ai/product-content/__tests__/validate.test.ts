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

  it("invented commerce: warns pair/set/warranty/gift box across EN/PT/RU", () => {
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "Sold as a pair or set with gift box and warranty." },
        pt: { title: "Anel", shortDescription: "Vendido em par, conjunto com garantia." },
        ru: { title: "Кольцо", shortDescription: "Пара в комплект, одна гарантия." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, baseFacts, ["en", "pt", "ru"]);
    const messages = (result?.warnings ?? []).map((w) => w.message);
    expect(messages.some((m) => /"pair"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"set"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"gift box"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"warranty"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"par"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"conjunto"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"garantia"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"пара"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"комплект"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"одна"/i.test(m))).toBe(true);
    expect(messages.some((m) => /"гарантия"/i.test(m))).toBe(true);
  });

  it("invented commerce: no warning when pair/warranty present in facts", () => {
    const pairFacts: ProductContentFacts = {
      ...baseFacts,
      name: "Quiet Pair Earrings",
      materialLine: "925 sterling silver pair with warranty card",
      characteristics: [
        {
          key: "material",
          label: "Material",
          value: "925 sterling silver pair with warranty card",
        },
      ],
    };
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "A quiet pair with warranty." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, pairFacts, ["en"]);
    expect(result!.warnings.filter((w) => /pair|warranty/i.test(w.message))).toEqual([]);
  });

  it("numeric guard: HTML facts 11 mm covers 11mm / 11 мм / 1,5cm", () => {
    const htmlFacts: ProductContentFacts = {
      ...baseFacts,
      name: "Crystal Pearl Bracelet",
      productType: "Bracelet",
      materialLine: "Pearl-effect crystal",
      description: "<p>Bead diameter <strong>11 mm</strong>. Length 18 cm. Weight 12 г.</p>",
      detailsAttributes: [{ label: "Alt", value: "1,5 cm accent" }],
      characteristics: [
        { key: "material", label: "Material", value: "pearl-effect crystal" },
        { key: "bead", label: "Bead", value: "11мм" },
      ],
    };
    const raw = JSON.stringify({
      locales: {
        en: { shortDescription: "Quiet 11mm pearl bracelet, 18cm long, about 12g." },
        pt: { title: "Pulseira", shortDescription: "Pérola de efeito, 11 mm, 1,5cm detalhe." },
        ru: { title: "Браслет", shortDescription: "Жемчужный браслет 11 мм, 12 г." },
      },
    });
    const result = validateAndNormalizeDraftLocales(raw, htmlFacts, ["en", "pt", "ru"]);
    expect(result!.warnings.filter((w) => /unsupported number/i.test(w.message))).toEqual([]);
    expect(
      result!.warnings.filter((w) => /pearl|pérola|жемчуг|pearl-effect/i.test(w.message)),
    ).toEqual([]);
  });

  it("bracelet regression fixture facts → 0 false number/pearl warnings", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { buildProductContentFacts } = await import("@/lib/ai/product-content/facts");
    const rawFixture = JSON.parse(
      readFileSync(
        join(process.cwd(), "scripts/ai/bench/fixtures/fixture-bracelet-pearl-measures.json"),
        "utf8",
      ),
    ) as {
      name: string;
      productType: string | null;
      materialLine: string | null;
      description: string | null;
      details: unknown;
      characteristics: Array<{
        key: string;
        label: string;
        textValue: string | null;
        numberValue: number | null;
        booleanValue: boolean | null;
        unit: string | null;
      }>;
      collections: Array<{ collection: { name: string } }>;
      translations: [];
    };
    expect(rawFixture).not.toHaveProperty("id");
    const facts = buildProductContentFacts({
      id: "",
      name: rawFixture.name,
      productType: rawFixture.productType,
      materialLine: rawFixture.materialLine,
      shortDescription: null,
      description: rawFixture.description,
      seoTitle: null,
      seoDescription: null,
      details: rawFixture.details,
      characteristics: rawFixture.characteristics,
      collections: rawFixture.collections,
      translations: rawFixture.translations,
    });
    const draft = JSON.stringify({
      locales: {
        en: {
          shortDescription: "Quiet pearl bracelet with 11mm beads, 18 cm length, 12g.",
        },
        pt: {
          title: "Pulseira",
          shortDescription: "Pulseira com pérola de efeito, contas de 11 mm.",
        },
        ru: {
          title: "Браслет",
          shortDescription: "Браслет с жемчужным эффектом, бусины 11 мм.",
        },
      },
    });
    const result = validateAndNormalizeDraftLocales(draft, facts, ["en", "pt", "ru"]);
    expect(result).not.toBeNull();
    expect(result!.warnings.filter((w) => /unsupported number/i.test(w.message))).toEqual([]);
    expect(
      result!.warnings.filter((w) => /pearl|pérola|жемчуг|pearl-effect/i.test(w.message)),
    ).toEqual([]);
  });
});
