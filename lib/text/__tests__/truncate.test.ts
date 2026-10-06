import { truncateText } from "../truncate";

describe("truncateText", () => {
  it("returns short text unchanged", () => {
    expect(truncateText("A short teaser.", 220)).toBe("A short teaser.");
  });

  it("cuts long text on a word boundary and appends an ellipsis", () => {
    const text =
      "Midnight Duck turns an everyday bag into something unmistakably individual and expressive.";
    const result = truncateText(text, 40);
    expect(result.endsWith("…")).toBe(true);
    expect(result.endsWith(" …")).toBe(false);
    expect(result.includes(" ")).toBe(true);
    // Kept body stays within the budget; ellipsis may add one character.
    expect(result.length - 1).toBeLessThanOrEqual(40);
  });

  it("trims surrounding whitespace before measuring length", () => {
    expect(truncateText("  padded  ", 20)).toBe("padded");
  });

  it("never leaves a single letter before the ellipsis", () => {
    const text =
      "Feita para o dia a dia, esta peça redefine a roupa. A história completa começa com cristal e ouro e muito mais texto.";
    for (let max = 45; max <= 70; max += 1) {
      const result = truncateText(text, max);
      expect(result.endsWith("…")).toBe(true);
      const body = result.slice(0, -1);
      const lastToken = body.trimEnd().split(/\s+/u).at(-1) ?? "";
      const letters = (lastToken.match(/[\p{L}\p{N}]/gu) ?? []).length;
      expect(letters).toBeGreaterThanOrEqual(3);
      expect(result).not.toMatch(/\sA…$/u);
      expect(result).not.toMatch(/\sa…$/u);
    }
  });

  it("never keeps a mid-word fragment when a prior word boundary exists", () => {
    const text = "beautiful craftsmanship details across the whole collection story";
    // Window ends inside "craftsmanship".
    const result = truncateText(text, "beautiful craftsmansh".length);
    expect(result).toBe("beautiful…");
    expect(result).not.toMatch(/craftsmansh/u);
  });

  it("peels a short last word before the ellipsis", () => {
    const text = "Midnight Duck turns an everyday bag into something unmistakably individual.";
    // Lands after a short connector / article-sized token depending on budget.
    const result = truncateText(text, 28);
    expect(result.endsWith("…")).toBe(true);
    const lastToken = result.slice(0, -1).trimEnd().split(/\s+/u).at(-1) ?? "";
    expect((lastToken.match(/[\p{L}\p{N}]/gu) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(result).not.toMatch(/\s(an|to|of|a|on)…$/iu);
  });

  it("matches the PDP orphan case (roupa. A…)", () => {
    const text =
      "Something about roupa. A história completa do produto com muitos detalhes adicionais aqui.";
    expect(truncateText(text, 28)).toBe("Something about roupa…");
    expect(truncateText(text, 28)).not.toContain("A…");
  });
});
