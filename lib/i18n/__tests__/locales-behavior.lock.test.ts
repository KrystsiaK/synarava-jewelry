/**
 * A1 lock: en / pt / ru storefront behavior must stay identical while the
 * registry becomes the sole routing source of truth (see ADR-0007).
 */
import { beforeEach, describe, expect, it } from "vitest";

import {
  BOOTSTRAP_LOCALES,
  DEFAULT_LOCALE,
  isSupportedLocale,
  normalizeLocale,
} from "@/lib/i18n/locales";
import {
  localePath,
  storefrontHref,
  stripLocalePrefix,
  toLocaleFreeHref,
} from "@/lib/i18n/routing";
import {
  getRegisteredRouteSegments,
  resetRegisteredRouteSegmentsForTests,
  setRegisteredRouteSegments,
} from "@/lib/i18n/registered-route-segments";

describe("A1 lock: bootstrap locales en/pt/ru", () => {
  it("ships exactly English, Portuguese, and Russian as bootstrap rows", () => {
    expect(BOOTSTRAP_LOCALES.map((locale) => locale.code)).toEqual(["en", "pt", "ru"]);
    expect(DEFAULT_LOCALE).toBe("en");
  });

  it("treats en, pt, and ru as supported locale codes", () => {
    expect(isSupportedLocale("en")).toBe(true);
    expect(isSupportedLocale("pt")).toBe(true);
    expect(isSupportedLocale("ru")).toBe(true);
    expect(isSupportedLocale("de")).toBe(false);
    expect(isSupportedLocale("")).toBe(false);
  });

  it("normalizes known codes and falls unknown values back to English", () => {
    expect(normalizeLocale("en")).toBe("en");
    expect(normalizeLocale("pt")).toBe("pt");
    expect(normalizeLocale("ru")).toBe("ru");
    expect(normalizeLocale("DE")).toBe("en");
    expect(normalizeLocale(null)).toBe("en");
    expect(normalizeLocale(undefined)).toBe("en");
  });
});

describe("A1 lock: path helpers for en/pt/ru", () => {
  beforeEach(() => {
    resetRegisteredRouteSegmentsForTests();
  });

  it("strips and rewrites the three bootstrap prefixes", () => {
    expect(stripLocalePrefix("/pt/shop")).toBe("/shop");
    expect(stripLocalePrefix("/ru/collections/axis")).toBe("/collections/axis");
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(toLocaleFreeHref("/pt/shop")).toBe("/shop");
    expect(localePath("pt", "/about")).toBe("/pt/about");
    expect(storefrontHref("ru", "/shop")).toBe("/ru/shop");
    expect(localePath("en", "/pt/shop")).toBe("/en/shop");
  });

  it("does not treat an unregistered content segment as a locale prefix", () => {
    expect(stripLocalePrefix("/shop")).toBe("/shop");
    expect(stripLocalePrefix("/new")).toBe("/new");
  });
});

describe("A1: registry-driven route segments", () => {
  beforeEach(() => {
    resetRegisteredRouteSegmentsForTests();
  });

  it("starts with bootstrap segments so offline stripping stays safe", () => {
    expect(getRegisteredRouteSegments().sort()).toEqual(["en", "pt", "ru"]);
  });

  it("strips a dynamically registered fourth language without a code deploy", () => {
    setRegisteredRouteSegments(["en", "pt", "ru", "de"]);
    expect(stripLocalePrefix("/de/shop")).toBe("/shop");
    expect(localePath("de", "/about")).toBe("/de/about");
    expect(normalizeLocale("de")).toBe("de");
  });

  it("stops stripping a non-bootstrap segment after it leaves the registry snapshot", () => {
    setRegisteredRouteSegments(["en", "pt", "ru", "de"]);
    expect(stripLocalePrefix("/de/shop")).toBe("/shop");
    setRegisteredRouteSegments(["en", "pt", "ru"]);
    expect(stripLocalePrefix("/de/shop")).toBe("/de/shop");
    expect(normalizeLocale("de")).toBe("en");
    // Bootstrap codes remain normalizable even if absent from a partial snapshot.
    expect(normalizeLocale("ru")).toBe("ru");
  });
});
