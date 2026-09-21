import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: { storefrontLocale: { findMany: mocks.findMany } },
}));

import {
  getPublishedStorefrontLocales,
  getStorefrontLocales,
  invalidateStorefrontLocaleCache,
} from "@/lib/i18n/storefront-locale-cache";

const ROWS = [
  { id: "1", code: "en", routeSegment: "en", isDefault: true, isPublished: true },
  { id: "2", code: "pt", routeSegment: "pt", isDefault: false, isPublished: true },
  { id: "3", code: "ru", routeSegment: "ru", isDefault: false, isPublished: false },
];

beforeEach(() => {
  mocks.findMany.mockReset();
  mocks.findMany.mockResolvedValue(ROWS);
  invalidateStorefrontLocaleCache();
});

describe("getStorefrontLocales", () => {
  it("returns every registered locale, published or not", async () => {
    expect((await getStorefrontLocales()).map((l) => l.code)).toEqual(["en", "pt", "ru"]);
  });

  it("serves a cached snapshot instead of re-querying within the TTL", async () => {
    await getStorefrontLocales();
    await getStorefrontLocales();
    expect(mocks.findMany).toHaveBeenCalledTimes(1);
  });

  it("re-queries after invalidateStorefrontLocaleCache", async () => {
    await getStorefrontLocales();
    invalidateStorefrontLocaleCache();
    await getStorefrontLocales();
    expect(mocks.findMany).toHaveBeenCalledTimes(2);
  });

  it("falls back to the last cached snapshot on a transient DB error after the TTL expires", async () => {
    vi.useFakeTimers();
    try {
      await getStorefrontLocales();
      mocks.findMany.mockRejectedValue(new Error("connection lost"));
      vi.advanceTimersByTime(31_000); // past the 30s TTL, forces a re-fetch attempt
      const locales = await getStorefrontLocales();
      expect(locales.map((l) => l.code)).toEqual(["en", "pt", "ru"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("returns an empty list when the DB has never been reachable", async () => {
    mocks.findMany.mockRejectedValue(new Error("connection refused"));
    expect(await getStorefrontLocales()).toEqual([]);
  });
});

describe("getPublishedStorefrontLocales", () => {
  it("excludes registered-but-unpublished locales", async () => {
    expect((await getPublishedStorefrontLocales()).map((l) => l.code)).toEqual(["en", "pt"]);
  });
});
