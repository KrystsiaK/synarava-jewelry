import { describe, expect, it } from "vitest";

import { BUILT_IN_PAGE_DEFINITIONS, isBuiltInPage, isRetiredPageSlug } from "@/lib/content/built-in-pages";

describe("built-in page definitions", () => {
  it("registers every admin-managed editorial and index route", () => {
    expect(BUILT_IN_PAGE_DEFINITIONS.map((page) => page.slug)).toEqual([
      "home",
      "about",
      "shop",
      "collections",
      "care",
      "shipping",
      "returns",
      "faq",
      "offer",
      "terms-and-conditions",
      "privacy",
      "dispute-resolution",
    ]);
  });

  it("protects built-in records while leaving custom pages removable", () => {
    expect(isBuiltInPage("shop")).toBe(true);
    expect(isBuiltInPage("privacy")).toBe(true);
    expect(isBuiltInPage("studio-notes")).toBe(false);
    expect(isBuiltInPage("legal-notice")).toBe(false);
    expect(isRetiredPageSlug("legal-notice")).toBe(true);
  });
});
