import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatSku,
  nextSequence,
  parseSku,
  validateSkuFormat,
} from "./format.js";
import { SYNARAVA_SHOP_PROFILE_V1_EXAMPLE } from "./profile.js";
import { previewSku } from "./preview.js";
import { resolveStem } from "./stem.js";

const profile = SYNARAVA_SHOP_PROFILE_V1_EXAMPLE;

describe("formatSku / parseSku", () => {
  it("round-trips stem and sequence", () => {
    const formatted = formatSku("JW-NECK", 7, profile);
    expect(formatted.ok).toBe(true);
    if (!formatted.ok) return;
    expect(formatted.value.sku).toBe("JW-NECK-007");

    const parsed = parseSku(formatted.value.sku, profile);
    expect(parsed).toEqual(formatted);
  });

  it("returns SEQUENCE_EXHAUSTED past 999", () => {
    const result = formatSku("JW-NECK", 1000, profile);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("SEQUENCE_EXHAUSTED");
  });

  it("property: parse(format(stem, seq)) === format for valid ranges", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...Object.values(profile.families)),
        fc.integer({ min: 1, max: 999 }),
        (stem, sequence) => {
          const formatted = formatSku(stem, sequence, profile);
          expect(formatted.ok).toBe(true);
          if (!formatted.ok) return;
          const parsed = parseSku(formatted.value.sku, profile);
          expect(parsed).toEqual(formatted);
        },
      ),
    );
  });
});

describe("nextSequence", () => {
  it("starts at suffix.start when empty", () => {
    expect(nextSequence(null, profile)).toEqual({ ok: true, value: 1 });
  });

  it("increments and exhausts at width max", () => {
    expect(nextSequence(998, profile)).toEqual({ ok: true, value: 999 });
    expect(nextSequence(999, profile).ok).toBe(false);
  });
});

describe("validateSkuFormat", () => {
  it("accepts profile-legal SKUs", () => {
    expect(validateSkuFormat("JW-NECK-001", profile.allowedCharacters).ok).toBe(
      true,
    );
  });

  it("rejects lowercase spaces", () => {
    expect(validateSkuFormat("bad sku", profile.allowedCharacters).ok).toBe(
      false,
    );
  });
});

describe("resolveStem / previewSku", () => {
  it("maps family to stem", () => {
    expect(resolveStem(profile, "jewelry.necklace")).toEqual({
      ok: true,
      value: "JW-NECK",
    });
  });

  it("unknown family is explicit", () => {
    const result = resolveStem(profile, "unknown.thing");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe("UNKNOWN_FAMILY");
  });

  it("preview is provisional and does not mutate profile", () => {
    const result = previewSku(profile, {
      familyKey: "bag.charm",
      lastAllocatedSequence: 2,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        sku: "BA-CH-003",
        stem: "BA-CH",
        sequence: 3,
        policyVersion: 1,
        familyKey: "bag.charm",
        provisional: true,
      },
    });
  });
});
