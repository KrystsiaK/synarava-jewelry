import { describe, expect, it } from "vitest";

import { localePath, storefrontHref } from "@/lib/i18n/routing";

describe("localePath", () => {
  it("prefixes locale onto root and nested paths", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("pt", "/about")).toBe("/pt/about");
  });
});

describe("storefrontHref", () => {
  it("prefixes internal paths and leaves absolute urls alone", () => {
    expect(storefrontHref("en", "/about")).toBe("/en/about");
    expect(storefrontHref("pt", "about")).toBe("/pt/about");
    expect(storefrontHref("ru", "https://example.com/x")).toBe("https://example.com/x");
    expect(storefrontHref("en", "mailto:studio@example.com")).toBe("mailto:studio@example.com");
  });
});
