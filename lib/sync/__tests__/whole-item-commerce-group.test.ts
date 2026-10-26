import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import { slice } from "@/lib/sync/select";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
] as const;

function compareProduct(ourWindow: unknown, shopifySnapshot: unknown) {
  return compareSyncState({
    commerceWindows: [{
      resourceType: "PRODUCT",
      resourceId: "p1",
      ourWindow,
      shopifySnapshot,
    }],
    translationDifferences: [],
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    connected: true,
    checkedAt: "2026-10-26T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-26T12:01:00.000Z"),
  });
}

describe("product whole-item commerce group", () => {
  it("Price + Cost + Weight + selectedOptions → Price leaf + group of 3", () => {
    const our = {
      variants: [{
        id: "v1",
        price: "10.00",
        selectedOptions: [{ name: "Title", value: "A" }],
        inventoryItem: {
          unitCost: { amount: "1.00", currencyCode: "EUR" },
          measurement: { weight: { value: 10, unit: "GRAMS" } },
        },
      }],
    };
    const shopify = {
      variants: [{
        id: "v1",
        price: "12.00",
        selectedOptions: [{ name: "Title", value: "B" }],
        inventoryItem: {
          unitCost: { amount: "2.00", currencyCode: "EUR" },
          measurement: { weight: { value: 20, unit: "GRAMS" } },
        },
      }],
    };
    const result = compareProduct(our, shopify);
    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce).toHaveLength(2);
    expect(commerce.map((leaf) => leaf.fieldKey).toSorted()).toEqual([
      "commerce:variants-0-price",
      "commerce:whole-item",
    ]);
    const group = commerce.find((leaf) => leaf.fieldKey === "commerce:whole-item")!;
    expect(group.label).toBe("Other product data (3 fields)");
    expect(group.blockedReason).toBeTruthy();
    expect(group.allowedDirections).toEqual([]);
    expect(group.synaravaValue.split("\n")).toHaveLength(3);
    expect(group.shopifyValue.split("\n")).toHaveLength(3);
    // Nested money/weight/options leaves use path-tail labels today (amount/value).
    expect(group.synaravaValue).toMatch(/: /);
    expect(group.localFingerprint).toBeTruthy();
    expect(group.shopifyFingerprint).not.toBe(group.localFingerprint);
  });

  it("variant 2 non-scoped diff lands in the group", () => {
    const our = {
      variants: [
        { id: "v1", price: "10.00", barcode: "111" },
        { id: "v2", price: "10.00", barcode: "222" },
      ],
    };
    const shopify = {
      variants: [
        { id: "v1", price: "10.00", barcode: "111" },
        { id: "v2", price: "10.00", barcode: "999" },
      ],
    };
    const result = compareProduct(our, shopify);
    const commerce = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(commerce).toHaveLength(1);
    expect(commerce[0]?.fieldKey).toBe("commerce:whole-item");
    expect(commerce[0]?.label).toBe("Other product data (1 fields)");
    expect(commerce[0]?.synaravaValue).toMatch(/Barcode: 222/);
    expect(commerce[0]?.shopifyValue).toMatch(/Barcode: 999/);
  });

  it("after windows match, the group leaf disappears", () => {
    const window = {
      variants: [{
        id: "v1",
        price: "10.00",
        barcode: "111",
        inventoryItem: { unitCost: { amount: "1.00", currencyCode: "EUR" } },
      }],
    };
    const before = compareProduct(
      window,
      {
        variants: [{
          id: "v1",
          price: "10.00",
          barcode: "999",
          inventoryItem: { unitCost: { amount: "9.00", currencyCode: "EUR" } },
        }],
      },
    );
    expect(before.leaves.some((leaf) => leaf.fieldKey === "commerce:whole-item")).toBe(true);

    const after = compareProduct(window, window);
    expect(after.leaves.some((leaf) => leaf.fieldKey === "commerce:whole-item")).toBe(false);
    expect(slice(after, { entityType: "PRODUCT", entityId: "p1" })).toHaveLength(0);
  });

  it("collections stay per-field (no whole-item group)", () => {
    const result = compareSyncState({
      commerceWindows: [{
        resourceType: "COLLECTION",
        resourceId: "c1",
        ourWindow: { title: "Local", handle: "x", descriptionHtml: "<p>A</p>" },
        shopifySnapshot: { title: "Remote", handle: "x", descriptionHtml: "<p>B</p>" },
      }],
      translationDifferences: [],
      productPresence: [],
      collectionPresence: [],
      locales: [...LOCALES],
      connected: true,
      checkedAt: "2026-10-26T12:00:00.000Z",
      runStatus: "SUCCEEDED",
      now: new Date("2026-10-26T12:01:00.000Z"),
    });
    expect(result.leaves.every((leaf) => leaf.fieldKey !== "commerce:whole-item")).toBe(true);
    expect(result.leaves.map((leaf) => leaf.label).toSorted()).toEqual(["Description", "Name"]);
  });
});
