import { describe, expect, it } from "vitest";

import { productConflictBadgeCount } from "@/components/admin/products/product-conflict-badge-count";
import { productConflictCompareSummary } from "@/components/admin/products/product-conflict-compare-summary";

const LOCALE_TABS = [
  { code: "en", label: "English" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

describe("productConflictCompareSummary", () => {
  it("stays at zero when only one-sided translation divergences exist (no signal, no commerce)", () => {
    // Cotton-thread style: AdminSyncInlineWarning used to count LOCAL_ONLY /
    // SHOPIFY_ONLY reconcile rows while the conflict icon stayed green.
    const summary = productConflictCompareSummary(null, {
      commerceFieldCount: 0,
      localeTabs: LOCALE_TABS,
    });
    expect(summary).toEqual({ count: 0, localeLabels: [] });
    expect(productConflictBadgeCount(null, { commerceFieldCount: 0 })).toBe(0);
  });

  it("matches icon badge count for shared commerce field diffs", () => {
    const signal = { shared: true, sharedCount: 2, locales: [] as Array<{ count: number; name: string; code: string; nativeName: string }> };
    const summary = productConflictCompareSummary(signal, {
      commerceFieldCount: 2,
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(productConflictBadgeCount(signal, { commerceFieldCount: 2 }));
    expect(summary.count).toBe(2);
    expect(summary.localeLabels).toEqual(["English", "Portuguese", "Russian"]);
  });

  it("matches icon badge when live inspect count differs from saved sharedCount", () => {
    const signal = { shared: true, sharedCount: 1, locales: [] as Array<{ count: number; name: string; code: string; nativeName: string }> };
    const summary = productConflictCompareSummary(signal, {
      commerceFieldCount: 12,
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(12);
    expect(summary.count).toBe(productConflictBadgeCount(signal, { commerceFieldCount: 12 }));
  });

  it("adds CONFLICT translation locale labels without inventing one-sided rows", () => {
    const signal = {
      shared: false,
      sharedCount: 0,
      locales: [
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
        { code: "ru", name: "Russian", nativeName: "Русский", count: 1 },
      ],
    };
    const summary = productConflictCompareSummary(signal, {
      commerceFieldCount: 0,
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(3);
    expect(summary.count).toBe(productConflictBadgeCount(signal, { commerceFieldCount: 0 }));
    expect(summary.localeLabels).toEqual(["Portuguese", "Russian"]);
  });

  it("combines commerce + translation CONFLICT counts like the icon", () => {
    const signal = {
      shared: true,
      sharedCount: 2,
      locales: [
        { code: "en", name: "English", nativeName: "English", count: 1 },
        { code: "pt", name: "Portuguese", nativeName: "Português", count: 2 },
      ],
    };
    const summary = productConflictCompareSummary(signal, {
      commerceFieldCount: 2,
      localeTabs: LOCALE_TABS,
    });
    expect(summary.count).toBe(5);
    expect(summary.count).toBe(productConflictBadgeCount(signal, { commerceFieldCount: 2 }));
    expect(summary.localeLabels).toEqual(["English", "Portuguese", "Russian"]);
  });
});
