import { describe, expect, it } from "vitest";

import {
  findDuplicateRouteSegments,
  findEnglishSourceViolation,
} from "@/lib/i18n/storefront-locale-registry";

describe("findDuplicateRouteSegments", () => {
  it("returns nothing when every segment is unique", () => {
    expect(findDuplicateRouteSegments([{ routeSegment: "en" }, { routeSegment: "pt" }])).toEqual([]);
  });

  it("flags a segment claimed by more than one locale", () => {
    expect(
      findDuplicateRouteSegments([{ routeSegment: "en" }, { routeSegment: "pt" }, { routeSegment: "pt" }]),
    ).toEqual(["pt"]);
  });
});

describe("findEnglishSourceViolation", () => {
  it("passes when exactly en is default", () => {
    expect(
      findEnglishSourceViolation([{ code: "en", isDefault: true }, { code: "pt", isDefault: false }]),
    ).toBeNull();
  });

  it("flags no default locale", () => {
    expect(findEnglishSourceViolation([{ code: "en", isDefault: false }])).toMatch(/no locale/i);
  });

  it("flags more than one default locale", () => {
    expect(
      findEnglishSourceViolation([{ code: "en", isDefault: true }, { code: "pt", isDefault: true }]),
    ).toMatch(/multiple locales/i);
  });

  it("flags a non-en default", () => {
    expect(findEnglishSourceViolation([{ code: "pt", isDefault: true }])).toMatch(/must be "en"/);
  });
});
