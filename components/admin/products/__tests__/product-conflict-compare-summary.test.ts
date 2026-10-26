import { describe, expect, it } from "vitest";

import { productConflictBadgeCount } from "@/lib/sync/badge-count";
import { productConflictCompareSummary } from "@/components/admin/products/product-conflict-compare-summary";

const LOCALE_TABS = [
  { code: "en", label: "English" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

describe("productConflictCompareSummary", () => {
  it("stays at zero when only one-sided translation divergences exist (no signal)", () => {
    const summary = productConflictCompareSummary(null, {
      localeTabs: LOCALE_TABS,
    });
    expect(summary).toEqual({ count: 0, localeLabels: [] });
    expect(productConflictBadgeCount(null)).toBe(0);
  });

  it("matches icon badge count from SyncResult leafCount for shared commerce", () => {
    const signal = {
      leafCount: 2,
      shared: true,
      sharedCount: 2,
      locales: [] as Array<{ count: number; name: string; code: string; nativeName: string }>,
    };
    const summary = productConflictCompareSummary(signal, {
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(productConflictBadgeCount(signal));
    expect(summary.count).toBe(2);
    expect(summary.localeLabels).toEqual(["English", "Portuguese", "Russian"]);
  });

  it("prefers SyncResult leafCount over sharedCount for the badge", () => {
    const signal = {
      leafCount: 12,
      shared: true,
      sharedCount: 1,
      locales: [] as Array<{ count: number; name: string; code: string; nativeName: string }>,
    };
    const summary = productConflictCompareSummary(signal, {
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(12);
    expect(summary.count).toBe(productConflictBadgeCount(signal));
  });

  it("adds CONFLICT translation locale labels without inventing one-sided rows", () => {
    const signal = {
      leafCount: 3,
      shared: false,
      sharedCount: 0,
      locales: [
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
        { code: "ru", name: "Russian", nativeName: "Русский", count: 1 },
      ],
    };
    const summary = productConflictCompareSummary(signal, {
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(3);
    expect(summary.count).toBe(productConflictBadgeCount(signal));
    expect(summary.localeLabels).toEqual(["Portuguese", "Russian"]);
  });

  it("combines commerce + translation CONFLICT counts like the icon", () => {
    const signal = {
      leafCount: 5,
      shared: true,
      sharedCount: 2,
      locales: [
        { code: "en", name: "English", nativeName: "English", count: 1 },
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
      ],
    };
    const summary = productConflictCompareSummary(signal, {
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(5);
    expect(summary.count).toBe(productConflictBadgeCount(signal));
    expect(summary.localeLabels).toEqual(["English", "Portuguese", "Russian"]);
  });
});
