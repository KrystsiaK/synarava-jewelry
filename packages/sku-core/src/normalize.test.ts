import { describe, expect, it } from "vitest";
import { normalizeFamilyKey, normalizeStem } from "./normalize.js";

describe("normalizeFamilyKey", () => {
  it("lowercases and collapses separators", () => {
    expect(normalizeFamilyKey(" Jewelry/Necklace ")).toEqual({
      ok: true,
      value: "jewelry.necklace",
    });
  });

  it("rejects empty and invalid keys", () => {
    expect(normalizeFamilyKey("").ok).toBe(false);
    expect(normalizeFamilyKey("Jewelry!").ok).toBe(false);
  });
});

describe("normalizeStem", () => {
  it("uppercases valid stems", () => {
    expect(normalizeStem("jw-neck", "-")).toEqual({
      ok: true,
      value: "JW-NECK",
    });
  });

  it("rejects empty stems", () => {
    expect(normalizeStem("  ", "-").ok).toBe(false);
  });
});
