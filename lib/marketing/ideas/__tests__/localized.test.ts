import { describe, expect, it } from "vitest";

import {
  localizedCopyBlob,
  localizedCopyNonEmpty,
  normalizeLocalizedCopy,
} from "@/lib/marketing/ideas/localized";

describe("normalizeLocalizedCopy", () => {
  it("maps legacy en string into { en, pt }", () => {
    expect(normalizeLocalizedCopy("Hello reel", "en")).toEqual({
      en: "Hello reel",
      pt: "",
    });
  });

  it("maps legacy pt string into { en, pt }", () => {
    expect(normalizeLocalizedCopy("Olá", "pt")).toEqual({
      en: "",
      pt: "Olá",
    });
  });

  it("keeps object shape", () => {
    expect(normalizeLocalizedCopy({ en: " A ", pt: " B " })).toEqual({
      en: "A",
      pt: "B",
    });
  });

  it("renders old rows via blob helpers", () => {
    const copy = normalizeLocalizedCopy("legacy hook", "en");
    expect(localizedCopyNonEmpty(copy)).toBe(true);
    expect(localizedCopyBlob(copy)).toContain("legacy hook");
  });
});
