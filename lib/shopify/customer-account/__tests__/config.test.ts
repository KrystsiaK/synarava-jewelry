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
    expect(safeCustomerReturnPath(value)).toBe("/profile");
  });
});
