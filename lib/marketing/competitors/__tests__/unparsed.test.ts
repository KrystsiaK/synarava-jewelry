import { describe, expect, it } from "vitest";

import { shouldSkipUnparsedExtraction } from "@/lib/marketing/competitors/unparsed";

describe("fix6 unparsed extraction", () => {
  it("skips row when extraction has neither name nor price", () => {
    expect(
      shouldSkipUnparsedExtraction({ name: null, price: null }),
    ).toBe(true);
    expect(
      shouldSkipUnparsedExtraction({ name: "", price: null }),
    ).toBe(true);
    expect(
      shouldSkipUnparsedExtraction({ name: "Ring", price: null }),
    ).toBe(false);
    expect(
      shouldSkipUnparsedExtraction({ name: null, price: 12 }),
    ).toBe(false);
  });
});
