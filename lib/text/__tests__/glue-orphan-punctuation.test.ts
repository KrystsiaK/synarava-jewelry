import { describe, expect, it } from "vitest";

import {
  glueOrphanPunctuation,
  glueOrphanPunctuationInHtml,
  isOrphanPunctuationToken,
  orphanPunctuationWrapUnits,
} from "@/lib/text/glue-orphan-punctuation";

describe("glueOrphanPunctuation", () => {
  it("glues middle dot to the previous word with NBSP", () => {
    expect(glueOrphanPunctuation("Жемчужный браслет · 8 мм")).toBe(
      "Жемчужный браслет\u00A0· 8 мм",
    );
  });

  it("glues en/em dashes and bullet-like marks", () => {
    expect(glueOrphanPunctuation("Pearl Necklace – 10 mm")).toBe(
      "Pearl Necklace\u00A0– 10 mm",
    );
    expect(glueOrphanPunctuation("Archive • Vol. I")).toBe(
      "Archive\u00A0• Vol. I",
    );
  });

  it("glues leading-punctuation tokens like ·8", () => {
    expect(glueOrphanPunctuation("браслет ·8 мм")).toBe("браслет\u00A0·8 мм");
  });

  it("preserves newlines in multi-line copy", () => {
    expect(glueOrphanPunctuation("Line one · A\nLine two – B")).toBe(
      "Line one\u00A0· A\nLine two\u00A0– B",
    );
  });

  it("leaves ordinary words unchanged", () => {
    expect(glueOrphanPunctuation("Аксессуары для сумок")).toBe(
      "Аксессуары для сумок",
    );
  });

  it("returns empty input unchanged", () => {
    expect(glueOrphanPunctuation("")).toBe("");
  });
});

describe("orphanPunctuationWrapUnits", () => {
  it("returns reveal/fit wrap units with glued orphans", () => {
    expect(orphanPunctuationWrapUnits("Жемчужный браслет · 8 мм")).toEqual([
      "Жемчужный",
      "браслет\u00A0·",
      "8",
      "мм",
    ]);
  });
});

describe("glueOrphanPunctuationInHtml", () => {
  it("glues orphan marks inside text nodes only", () => {
    expect(
      glueOrphanPunctuationInHtml("<p>Pearl Bracelet · 8 mm</p>"),
    ).toBe("<p>Pearl Bracelet\u00A0· 8 mm</p>");
  });

  it("does not alter tag attributes", () => {
    const html =
      '<p><a href="/shop?q=ring · 4">Pearl · 4 mm</a></p>';
    expect(glueOrphanPunctuationInHtml(html)).toBe(
      '<p><a href="/shop?q=ring · 4">Pearl\u00A0· 4 mm</a></p>',
    );
  });
});

describe("isOrphanPunctuationToken", () => {
  it("classifies orphan punctuation tokens", () => {
    expect(isOrphanPunctuationToken("·")).toBe(true);
    expect(isOrphanPunctuationToken("–")).toBe(true);
    expect(isOrphanPunctuationToken("·8")).toBe(true);
    expect(isOrphanPunctuationToken("браслет")).toBe(false);
  });
});
