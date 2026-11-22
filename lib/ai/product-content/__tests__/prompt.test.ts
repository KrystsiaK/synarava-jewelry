import { describe, expect, it } from "vitest";

import {
  BANNED_CLICHES,
  buildEditorSystemInstruction,
  buildEditorUserPrompt,
  buildSystemInstruction,
  buildUserPrompt,
} from "@/lib/ai/product-content/prompt";
import type { ProductContentFacts } from "@/lib/ai/product-content/facts";

const facts: ProductContentFacts = {
  productId: "p1",
  name: "River Brooch",
  productType: "Brooch",
  materialLine: null,
  shortDescription: null,
  description: null,
  seoTitle: null,
  seoDescription: null,
  detailsAttributes: [],
  characteristics: [],
  collections: [],
  translations: [],
};

describe("prompt glossary + anti-cliché + editor", () => {
  it("includes brooch glossary and PT-PT 1990 reform (coleção)", () => {
    const system = buildSystemInstruction(["en", "pt", "ru"]);
    expect(system).toMatch(/brooch/i);
    expect(system).toMatch(/broche/);
    expect(system).toMatch(/брошь/);
    expect(system).toMatch(/coleção/);
    expect(system).toMatch(/not colecção/);
    expect(system).toMatch(/1990/);
  });

  it("lists banned clichés in the system instruction", () => {
    const system = buildSystemInstruction(["en"]);
    expect(BANNED_CLICHES.length).toBeGreaterThan(0);
    expect(system).toMatch(/timeless elegance/i);
  });

  it("forbids inventing commerce details and ignores prompt-injection", () => {
    const system = buildSystemInstruction(["en"]);
    expect(system).toMatch(/quantity|pair\/set|packaging|warranty|shipping/i);
    expect(system).toMatch(/prompt-injection/i);
  });

  it("instructs gold-tone / dourado / золотистые for coating-only PVD/plating", () => {
    const system = buildSystemInstruction(["en", "pt", "ru"]);
    expect(system).toMatch(/gold-tone/i);
    expect(system).toMatch(/dourado/i);
    expect(system).toMatch(/золотист/i);
    expect(system).toMatch(/silver-tone|prateado|серебрист/i);
    expect(system).toMatch(/PVD|plating|plated|coating/i);
    expect(system).toMatch(/solid gold|14K|18K|925/i);
  });

  it("user prompt reminds glossary", () => {
    const user = buildUserPrompt(facts, ["en", "pt", "ru"]);
    expect(user).toMatch(/broche/);
    expect(user).toMatch(/брошь/);
    expect(user).toMatch(/coleção/);
  });

  it("10: editor prompt forbids adding/changing facts and includes draft", () => {
    const system = buildEditorSystemInstruction(["en", "pt", "ru"]);
    expect(system).toMatch(/MUST NOT add or change facts/i);
    expect(system).toMatch(/cliché/i);
    const user = buildEditorUserPrompt(
      facts,
      { en: { shortDescription: "Quiet brooch." } },
      ["en"],
    );
    expect(user).toMatch(/Quiet brooch/);
    expect(user).toMatch(/MUST NOT add\/change facts/i);
  });
});
