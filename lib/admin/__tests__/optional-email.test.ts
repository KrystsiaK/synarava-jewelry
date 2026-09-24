import { describe, expect, it } from "vitest";

import { isValidOptionalEmail } from "@/lib/admin/optional-email";

describe("isValidOptionalEmail", () => {
  it("allows empty and whitespace-only values", () => {
    expect(isValidOptionalEmail("")).toBe(true);
    expect(isValidOptionalEmail("   ")).toBe(true);
  });

  it("accepts a normal email", () => {
    expect(isValidOptionalEmail("studio@synarava.com")).toBe(true);
  });

  it("rejects incomplete or malformed addresses", () => {
    expect(isValidOptionalEmail("not-an-email")).toBe(false);
    expect(isValidOptionalEmail("studio@")).toBe(false);
    expect(isValidOptionalEmail("@synarava.com")).toBe(false);
  });
});
