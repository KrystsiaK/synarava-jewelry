import { describe, expect, it } from "vitest";

import {
  localePath,
  storefrontHref,
  stripLocalePrefix,
  toLocaleFreeHref,
} from "@/lib/i18n/routing";

describe("stripLocalePrefix / toLocaleFreeHref", () => {
  it("strips leading locale segments and leaves bare paths alone", () => {
    expect(stripLocalePrefix("/pt/shop")).toBe("/shop");
    expect(stripLocalePrefix("/ru/collections/axis")).toBe("/collections/axis");
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/pt/")).toBe("/");
    expect(stripLocalePrefix("/shop")).toBe("/shop");
    expect(toLocaleFreeHref("/pt/shop")).toBe("/shop");
    expect(toLocaleFreeHref("oak")).toBe("oak");
    expect(toLocaleFreeHref("https://example.com/pt/shop")).toBe("https://example.com/pt/shop");
    expect(toLocaleFreeHref("mailto:a@b.c")).toBe("mailto:a@b.c");
  });
});

describe("localePath", () => {
  it("prefixes locale onto root and nested paths", () => {
    expect(localePath("en", "/")).toBe("/en");
    expect(localePath("pt", "/about")).toBe("/pt/about");
  });

  it("is idempotent when the path already carries a locale segment", () => {
    expect(localePath("pt", "/pt/shop")).toBe("/pt/shop");
    expect(localePath("en", "/pt/shop")).toBe("/en/shop");
    expect(localePath("ru", "/ru")).toBe("/ru");
  });
});

describe("storefrontHref", () => {
  it("prefixes internal paths and leaves absolute urls alone", () => {
    expect(storefrontHref("en", "/about")).toBe("/en/about");
    expect(storefrontHref("pt", "about")).toBe("/pt/about");
    expect(storefrontHref("ru", "https://example.com/x")).toBe("https://example.com/x");
    expect(storefrontHref("en", "mailto:studio@example.com")).toBe("mailto:studio@example.com");
  });

  it("rewrites a stored locale-prefixed path to the active locale", () => {
    expect(storefrontHref("pt", "/pt/shop")).toBe("/pt/shop");
    expect(storefrontHref("en", "/pt/shop")).toBe("/en/shop");
    expect(storefrontHref("ru", "/shop")).toBe("/ru/shop");
  });
});
