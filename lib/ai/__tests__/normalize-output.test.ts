import { describe, expect, it } from "vitest";

import {
  normalizeAiJson,
  normalizeAiText,
} from "@/lib/ai/normalize-output";

/** Invisible / bidi / BOM / soft-hyphen samples required by the shared AI normalizer. */
const INVISIBLE_SAMPLES: Array<{ label: string; char: string }> = [
  { label: "ZWSP U+200B", char: "\u200B" },
  { label: "ZWNJ U+200C", char: "\u200C" },
  { label: "ZWJ alone U+200D", char: "\u200D" },
  { label: "LRM U+200E", char: "\u200E" },
  { label: "RLM U+200F", char: "\u200F" },
  { label: "LRE U+202A", char: "\u202A" },
  { label: "RLE U+202B", char: "\u202B" },
  { label: "PDF U+202C", char: "\u202C" },
  { label: "LRO U+202D", char: "\u202D" },
  { label: "RLO U+202E", char: "\u202E" },
  { label: "WJ U+2060", char: "\u2060" },
  { label: "func apply U+2061", char: "\u2061" },
  { label: "invisible times U+2062", char: "\u2062" },
  { label: "invisible sep U+2063", char: "\u2063" },
  { label: "invisible plus U+2064", char: "\u2064" },
  { label: "BOM U+FEFF", char: "\uFEFF" },
  { label: "soft hyphen U+00AD", char: "\u00AD" },
];

describe("normalizeAiText", () => {
  it("strips each invisible / bidi / BOM / soft-hyphen character", () => {
    for (const { label, char } of INVISIBLE_SAMPLES) {
      expect(normalizeAiText(`a${char}b`), label).toBe("ab");
      expect(normalizeAiText(char), label).toBe("");
    }
  });

  it("converts NBSP and narrow NBSP to space, collapses repeats, trims lines", () => {
    expect(normalizeAiText("a\u00A0\u00A0b")).toBe("a b");
    expect(normalizeAiText("a\u202Fb")).toBe("a b");
    expect(normalizeAiText("  hello   world  ")).toBe("hello world");
    expect(normalizeAiText("  line one  \n  line  two  \n")).toBe("line one\nline two");
  });

  it("NFC-normalizes combining forms", () => {
    // e + combining acute → é
    expect(normalizeAiText("e\u0301")).toBe("é");
  });

  it("preserves emoji ZWJ family sequences", () => {
    const family = "👨\u200D👩\u200D👧\u200D👦";
    expect(normalizeAiText(family)).toBe(family);
    expect(normalizeAiText(`Hi ${family}!`)).toBe(`Hi ${family}!`);
  });

  it("preserves Portuguese and Cyrillic diacritics", () => {
    expect(normalizeAiText("ação")).toBe("ação");
    expect(normalizeAiText("ёлка")).toBe("ёлка");
  });
});

describe("normalizeAiJson", () => {
  it("recursively normalizes nested string leaves", () => {
    const dirty = {
      title: `ação\u200B`,
      nested: { body: `ё\uFEFF`, tags: [`a\u00A0b`, "👨\u200D👩"] },
    };
    expect(normalizeAiJson(dirty)).toEqual({
      title: "ação",
      nested: { body: "ё", tags: ["a b", "👨\u200D👩"] },
    });
  });
});
