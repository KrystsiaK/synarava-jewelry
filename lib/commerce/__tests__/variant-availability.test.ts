import { describe, expect, it } from "vitest";

import { isVariantPurchasable } from "../variant-availability";

function variant(overrides: Partial<Parameters<typeof isVariantPurchasable>[0]> = {}) {
  return { status: "ACTIVE", stockOnHand: 0, inventoryPolicy: "DENY", tracked: true, ...overrides };
}

describe("isVariantPurchasable", () => {
  it("is purchasable when tracked DENY stock is positive", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 1 }))).toBe(true);
  });

  it("is not purchasable when tracked DENY stock is zero", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0 }))).toBe(false);
  });

  it("allows overselling when the policy is CONTINUE, even at zero or negative stock", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0, inventoryPolicy: "CONTINUE" }))).toBe(true);
    expect(isVariantPurchasable(variant({ stockOnHand: -3, inventoryPolicy: "CONTINUE" }))).toBe(true);
  });

  it("is always purchasable when inventory isn't tracked, regardless of policy", () => {
    expect(isVariantPurchasable(variant({ stockOnHand: 0, tracked: false }))).toBe(true);
  });

  it("is never purchasable when the variant itself isn't active", () => {
    expect(isVariantPurchasable(variant({ status: "DRAFT", stockOnHand: 5, inventoryPolicy: "CONTINUE", tracked: false }))).toBe(false);
  });
});
