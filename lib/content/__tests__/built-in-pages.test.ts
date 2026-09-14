import { describe, expect, it } from "vitest";

import { BUILT_IN_PAGE_DEFINITIONS, isBuiltInPage } from "@/lib/content/built-in-pages";

describe("built-in page definitions", () => {
  it("registers every admin-managed editorial and index route", () => {
    expect(BUILT_IN_PAGE_DEFINITIONS.map((page) => page.slug)).toEqual([
      "home",
      "about",
      "shop",
      "collections",
      "journal",
      "care",
      "shipping",
      "returns",
      "faq",
      "offer",
      "privacy",
    ]);
  });

  it("protects built-in records while leaving custom pages removable", () => {
    expect(isBuiltInPage("shop")).toBe(true);
    expect(isBuiltInPage("privacy")).toBe(true);
    expect(isBuiltInPage("studio-notes")).toBe(false);
  });
});
