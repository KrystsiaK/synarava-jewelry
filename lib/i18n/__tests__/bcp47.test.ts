import { describe, expect, it } from "vitest";

import { isValidBcp47 } from "@/lib/i18n/bcp47";

describe("isValidBcp47", () => {
  it("accepts bare language codes", () => {
    expect(isValidBcp47("en")).toBe(true);
    expect(isValidBcp47("pt")).toBe(true);
    expect(isValidBcp47("ru")).toBe(true);
  });

  it("accepts language-region codes", () => {
    expect(isValidBcp47("pt-PT")).toBe(true);
    expect(isValidBcp47("en-US")).toBe(true);
  });

  it("accepts language-script-region codes", () => {
    expect(isValidBcp47("zh-Hans-CN")).toBe(true);
  });

  it("accepts a 3-digit UN M49 area region", () => {
    expect(isValidBcp47("es-419")).toBe(true);
  });

  it("rejects malformed tags", () => {
    expect(isValidBcp47("")).toBe(false);
    expect(isValidBcp47("english")).toBe(false);
    expect(isValidBcp47("pt-pt")).toBe(false);
    expect(isValidBcp47("PT")).toBe(false);
    expect(isValidBcp47("pt_PT")).toBe(false);
    expect(isValidBcp47("pt-PT-extra-stuff")).toBe(false);
  });
});
