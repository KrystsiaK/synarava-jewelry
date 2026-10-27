import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { catalogConflictSignalsFromSyncResult } from "@/lib/sync/signals-from-result";
import { compareSyncState } from "@/lib/sync/compare";
import { selectSyncCounts } from "@/lib/sync/select";
import { productConflictBadgeCount } from "@/lib/sync/badge-count";

const root = process.cwd();

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

describe("no consumer-side path/label heuristics (PR-9)", () => {
  it("commerce-conflict-section does not regex-route variants/media paths", () => {
    const source = stripComments(read("components/admin/products/commerce-conflict-section.ts"));
    expect(source).not.toMatch(/\/\^variants\\\[\\d\+\\\]/);
    expect(source).not.toMatch(/\/\^media\(/);
    expect(source).toMatch(/lookupContractForPath|field\.section|parts/);
  });

  it("product-edit-form tab dots come from signal.sections", () => {
    const source = read("components/admin/products/product-edit-form.tsx");
    expect(source).toMatch(/productConflict\?\.sections/);
    expect(source).not.toMatch(/shared && isSharedSection\(activeSection\)/);
  });
});

describe("identical counts across nav / list / banner / locale / section (PR-9)", () => {
  it("Cost+Collections whole-item: list=banner=1; price section=1; media section=0", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: {
          collections: [{ id: "c1" }],
          variants: [{ id: "v1", inventoryItem: { unitCost: { amount: "1.00", currencyCode: "EUR" } } }],
        },
        shopifySnapshot: {
          collections: [{ id: "c2" }],
          variants: [{ id: "v1", inventoryItem: { unitCost: { amount: "2.00", currencyCode: "EUR" } } }],
        },
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [
        { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      ],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });

    const list = selectSyncCounts(result, { kind: "listChip", resourceType: "PRODUCT", resourceId: "p1" });
    const banner = selectSyncCounts(result, { kind: "editorBanner", resourceType: "PRODUCT", resourceId: "p1" });
    const locale = selectSyncCounts(result, {
      kind: "localeTab", resourceType: "PRODUCT", resourceId: "p1", locale: "en",
    });
    const price = selectSyncCounts(result, {
      kind: "sectionChip", resourceType: "PRODUCT", resourceId: "p1", locale: "en", section: "price",
    });
    const media = selectSyncCounts(result, {
      kind: "sectionChip", resourceType: "PRODUCT", resourceId: "p1", locale: "en", section: "media",
    });
    const nav = selectSyncCounts(result, { kind: "nav" });

    expect(list).toBe(1);
    expect(banner).toBe(list);
    expect(locale).toBe(list);
    expect(price).toBe(1);
    expect(media).toBe(0);
    expect(nav.products).toBe(1);

    const signals = catalogConflictSignalsFromSyncResult(result, "PRODUCT");
    expect(productConflictBadgeCount(signals.products.p1)).toBe(list);
    expect(signals.products.p1?.sections?.toSorted()).toEqual(["essentials", "price"]);
  });
});

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}
