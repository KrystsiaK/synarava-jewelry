import { describe, expect, it } from "vitest";

import {
  COLLECTION_COMMERCE_FIELDS,
  PRODUCT_COMMERCE_FIELDS,
  labelForWindowPath,
  lookupContractForPath,
  pathMatchesWindowPattern,
} from "@/lib/sync/field-registry";
import { compareSyncState } from "@/lib/sync/compare";
import { catalogConflictSignalsFromSyncResult } from "@/lib/sync/signals-from-result";
import { selectSyncCounts } from "@/lib/sync/select";
import { fieldMatchesViewSection } from "@/components/admin/products/catalog-conflict-view";
import { catalogConflictFieldsFromLeaves } from "@/lib/sync/conflict-fields-from-leaves";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
] as const;

describe("field contract path matching (PR-6)", () => {
  it("matches nested paths on segment boundaries (Cost, not amount)", () => {
    expect(pathMatchesWindowPattern(
      "variants[0].inventoryItem.unitCost.amount",
      "variants[].inventoryItem.unitCost",
    )).toBe(true);
    expect(labelForWindowPath("variants[0].inventoryItem.unitCost.amount")).toBe("Cost");
    expect(labelForWindowPath("variants[0].inventoryItem.tracked")).toBe("Track quantity");
    expect(labelForWindowPath("variants[0].inventoryItem.measurement.weight.value")).toBe("Weight");
    expect(labelForWindowPath("variants[0].inventoryItem.requiresShipping")).toBe("Requires shipping");
    expect(labelForWindowPath("variants[0].selectedOptions")).toBe("Selected options");
  });

  it("does not use last-segment fallback for unknown paths", () => {
    expect(labelForWindowPath("variants[0].mysteryField")).toBe(
      "Unmapped Shopify field variants[0].mysteryField",
    );
    expect(lookupContractForPath("variants[0].mysteryField")).toBeNull();
  });
});

describe("field contract completeness (PR-6)", () => {
  it("every entry has unique key/path/label/section/scope/ownership/valueType/normalizer/apply flags", () => {
    for (const registry of [PRODUCT_COMMERCE_FIELDS, COLLECTION_COMMERCE_FIELDS]) {
      const contractKeys = new Set<string>();
      const pathOwners = new Map<string, string>();
      for (const field of registry) {
        expect(field.contractKey.length).toBeGreaterThan(0);
        expect(contractKeys.has(field.contractKey), field.contractKey).toBe(false);
        contractKeys.add(field.contractKey);
        expect(field.label.length).toBeGreaterThan(0);
        expect(field.section).toBeTruthy();
        expect(["base", "locale", "synaravaOnly"]).toContain(field.scope);
        expect(["shopify", "synarava", "shared"]).toContain(field.ownership);
        expect(field.valueType).toBeTruthy();
        expect(field.normalizerId.length).toBeGreaterThan(0);
        expect(["scoped", "whole-record-only", "unsupported"]).toContain(field.applyToSynarava);
        expect(["scoped", "whole-record-only", "unsupported"]).toContain(field.applyToShopify);
        expect(field.scopedApply).toBe(
          field.applyToSynarava === "scoped" && field.applyToShopify === "scoped",
        );
        for (const path of field.windowPaths) {
          const prev = pathOwners.get(path);
          expect(prev, `overlapping path ${path}`).toBeUndefined();
          pathOwners.set(path, field.contractKey);
        }
      }
    }
    // Cross-registry contractKeys stay unique (collection.* prefix).
    const keys = [...PRODUCT_COMMERCE_FIELDS, ...COLLECTION_COMMERCE_FIELDS].map((f) => f.contractKey);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("whole-item parts + section routing (PR-6)", () => {
  it("Cost + Collections → ONE leaf with 2 parts; Price/Essentials lit, Media/Stock not", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: {
          collections: [{ id: "c1", handle: "a" }],
          variants: [{
            id: "v1",
            inventoryItem: { unitCost: { amount: "1.00", currencyCode: "EUR" } },
          }],
        },
        shopifySnapshot: {
          collections: [{ id: "c2", handle: "b" }],
          variants: [{
            id: "v1",
            inventoryItem: { unitCost: { amount: "2.00", currencyCode: "EUR" } },
          }],
        },
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });

    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce).toHaveLength(1);
    const leaf = commerce[0]!;
    expect(leaf.fieldKey).toBe("commerce:whole-item");
    expect(leaf.parts?.map((p) => p.label).toSorted()).toEqual(["Collections", "Cost"]);
    expect(leaf.parts?.find((p) => p.label === "Cost")?.section).toBe("price");
    expect(leaf.parts?.find((p) => p.label === "Collections")?.section).toBe("essentials");

    const signals = catalogConflictSignalsFromSyncResult(result, "PRODUCT");
    expect(signals.products.p1?.sections?.toSorted()).toEqual(["essentials", "price"]);
    expect(signals.products.p1?.sections).not.toContain("media");
    expect(signals.products.p1?.sections).not.toContain("inventory");

    expect(selectSyncCounts(result, {
      kind: "sectionChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "en",
      section: "price",
    })).toBe(1);
    expect(selectSyncCounts(result, {
      kind: "sectionChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "en",
      section: "essentials",
    })).toBe(1);
    expect(selectSyncCounts(result, {
      kind: "sectionChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "en",
      section: "media",
    })).toBe(0);
    expect(selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(1);

    const fields = catalogConflictFieldsFromLeaves(result.leaves, []);
    expect(fieldMatchesViewSection(fields[0]!, "price", "en")).toBe(true);
    expect(fieldMatchesViewSection(fields[0]!, "essentials", "en")).toBe(true);
    expect(fieldMatchesViewSection(fields[0]!, "media", "en")).toBe(false);
  });

  it("presence-only → Sync section only", () => {
    const result = compareSyncState({
      commerceWindows: [],
      translationDifferences: [],
      productPresence: [{
        id: "p1",
        kind: "SHOPIFY_ONLY",
        name: "Ring",
        handle: "ring",
        sku: null,
        localProductId: null,
        shopifyProductId: "gid://shopify/Product/1",
        remoteMissing: false,
        matchReason: null,
        localIdentity: null,
        shopifyIdentity: { name: "Ring", handle: "ring", sku: "" },
        localFingerprint: "a",
        shopifyFingerprint: "b",
      }],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-27T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-27T12:01:00.000Z"),
    });
    const signals = catalogConflictSignalsFromSyncResult(result, "PRODUCT");
    expect(signals.products.p1?.sections).toEqual(["shopify"]);
    expect(selectSyncCounts(result, {
      kind: "sectionChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "en",
      section: "shopify",
    })).toBe(1);
  });
});
