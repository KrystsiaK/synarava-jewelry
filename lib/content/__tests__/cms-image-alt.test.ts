import { describe, expect, it } from "vitest";

import { cmsImageAltOrFallback, resolveCmsImageAlt } from "@/lib/content/cms-image-alt";

describe("cms image alt helpers", () => {
  it("trims configured alt and treats blank as empty", () => {
    expect(resolveCmsImageAlt("  Pearls  ")).toBe("Pearls");
    expect(resolveCmsImageAlt("")).toBe("");
    expect(resolveCmsImageAlt(null)).toBe("");
  });

  it("falls back when configured alt is blank", () => {
    expect(cmsImageAltOrFallback("", "Collection name")).toBe("Collection name");
    expect(cmsImageAltOrFallback("Configured", "Collection name")).toBe("Configured");
  });
});
