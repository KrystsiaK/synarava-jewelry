import { describe, expect, it } from "vitest";

import { buildCatalogConflictSignals } from "@/lib/shopify/catalog-conflict-signals";

const locales = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
  { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
  { code: "de", shopifyLocale: "de", name: "German", nativeName: "Deutsch", isDefault: false, sortOrder: 3 },
];

const difference = (rootEntityId: string, locale: string, fieldKey: string, kind = "CONFLICT") => ({
  rootEntityType: "PRODUCT" as const, rootEntityId, locale, fieldKey, kind,
});

describe("buildCatalogConflictSignals", () => {
  it("deduplicates products, counts only conflicts, and follows the locale registry including RU and future locales", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a", "b"],
      differences: [
        difference("a", "pt-PT", "title"),
        difference("a", "pt-PT", "title"),
        difference("a", "pt-PT", "description"),
        difference("a", "ru", "title"),
        difference("a", "de", "title"),
        difference("b", "en", "title"),
        difference("c", "ru", "title", "LOCAL_ONLY"),
        { ...difference("c", "ru", "title"), rootEntityType: "COLLECTION" },
      ],
      locales,
      run: { trigger: "MANUAL", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true,
      recentlyUpdatedProducts: [{ productId: "c", updatedAt: "2026-09-23T09:59:00.000Z" }],
      now: new Date("2026-09-23T10:01:00.000Z"),
    });

    expect(result.totalCount).toBe(2);
    expect(result.products["a"]).toMatchObject({
      shared: true,
      locales: [
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
        { code: "ru", nativeName: "Русский", count: 1 },
        { code: "de", nativeName: "Deutsch", count: 1 },
      ],
    });
    expect(result.products["b"]?.locales).toMatchObject([{ code: "en", count: 1 }]);
    expect(result.products["c"]).toBeUndefined();
    expect(result.recentlyUpdatedProducts["c"]).toEqual({ updatedAt: "2026-09-23T09:59:00.000Z" });
    expect(result.state).toBe("ready");
  });

  it.each([
    [false, "SUCCEEDED", "disconnected"],
    [true, "RUNNING", "checking"],
    [true, "FAILED", "failed"],
    [true, "PARTIAL", "failed"],
    [true, "SUCCEEDED", "stale"],
  ] as const)("derives %s / %s as %s without hiding persisted conflicts", (connected, status, expected) => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a"], differences: [], locales,
      run: { trigger: "MANUAL", status, completedAt: "2026-09-20T10:00:00.000Z" },
      connected, now: new Date("2026-09-23T10:00:00.000Z"),
    });
    expect(result.state).toBe(expected);
    expect(result.totalCount).toBe(1);
  });

  it("does not mistake a recent single-locale check for a fresh catalog-wide check", () => {
    const result = buildCatalogConflictSignals({
      commerceProductIds: ["a"], differences: [], locales,
      run: { trigger: "LOCALE", status: "SUCCEEDED", completedAt: "2026-09-23T10:00:00.000Z" },
      connected: true, now: new Date("2026-09-23T10:01:00.000Z"),
    });
    expect(result.state).toBe("stale");
    expect(result.totalCount).toBe(1);
  });

  it("keeps the last successful full-check time visible while a newer scoped check is running or has failed", () => {
    for (const status of ["RUNNING", "FAILED"] as const) {
      const result = buildCatalogConflictSignals({
        commerceProductIds: ["a"], differences: [], locales,
        run: { trigger: "LOCALE", status, completedAt: null },
        lastSuccessfulFullCheckAt: "2026-09-23T09:55:00.000Z",
        connected: true, now: new Date("2026-09-23T10:00:00.000Z"),
      });
      expect(result.checkedAt).toBe("2026-09-23T09:55:00.000Z");
      expect(result.state).toBe(status === "RUNNING" ? "checking" : "failed");
    }
  });
});
