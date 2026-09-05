import { describe, expect, it } from "vitest";

import { safeCustomerReturnPath } from "../config";

describe("safeCustomerReturnPath", () => {
  it("keeps local paths and query strings", () => {
    expect(safeCustomerReturnPath("/profile?tab=orders")).toBe(
      "/profile?tab=orders",
    );
  });

  it.each([
    undefined,
    null,
    "",
    "profile",
    "//attacker.example/path",
    "https://attacker.example/path",
  ])("falls back for unsafe value %s", (value) => {
    expect(safeCustomerReturnPath(value)).toBe("/en/profile");
  });

  it("locale-prefixes the fallback for a given locale", () => {
    expect(safeCustomerReturnPath(undefined, "pt")).toBe("/pt/profile");
  });

  it("keeps a locale-prefixed local path", () => {
    expect(safeCustomerReturnPath("/pt/checkout/shipping")).toBe(
      "/pt/checkout/shipping",
    );
  });
});
