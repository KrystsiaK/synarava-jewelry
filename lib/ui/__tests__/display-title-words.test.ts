import { describe, expect, it } from "vitest";

import {
  displayTitleWords,
  formatDisplayTitle,
  isOrphanPunctuationToken,
} from "@/lib/ui/display-title-words";

describe("displayTitleWords", () => {
  it("glues middle dot to the previous word with NBSP", () => {
    expect(displayTitleWords("Жемчужный браслет · 8 мм")).toEqual([
      "Жемчужный",
      "браслет\u00A0·",
      "8",
      "мм",
    ]);
  });

  it("glues en/em dashes and bullet-like marks", () => {
    expect(displayTitleWords("Pearl Necklace – 10 mm")).toEqual([
      "Pearl",
      "Necklace\u00A0–",
      "10",
      "mm",
    ]);
    expect(displayTitleWords("Archive • Vol. I")).toEqual([
      "Archive\u00A0•",
      "Vol.",
      "I",
    ]);
  });

  it("glues leading-punctuation tokens like ·8", () => {
    expect(displayTitleWords("браслет ·8 мм")).toEqual([
      "браслет\u00A0·8",
      "мм",
    ]);
  });

  it("leaves ordinary words unchanged", () => {
    expect(displayTitleWords("Аксессуары для сумок")).toEqual([
      "Аксессуары",
      "для",
      "сумок",
    ]);
  });

  it("formatDisplayTitle preserves readable spacing", () => {
    expect(formatDisplayTitle("Жемчужный браслет · 8 мм")).toBe(
      "Жемчужный браслет\u00A0· 8 мм",
    );
  });

  it("classifies orphan punctuation tokens", () => {
    expect(isOrphanPunctuationToken("·")).toBe(true);
    expect(isOrphanPunctuationToken("–")).toBe(true);
    expect(isOrphanPunctuationToken("·8")).toBe(true);
    expect(isOrphanPunctuationToken("браслет")).toBe(false);
  });
});
