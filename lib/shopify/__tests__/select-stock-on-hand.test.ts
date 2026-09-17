import { describe, expect, it } from "vitest";

import { selectStockOnHand } from "../inventory-levels";

const levels = [
  { location: { id: "gid://shopify/Location/1" }, quantities: [{ name: "available", quantity: 3 }] },
  { location: { id: "gid://shopify/Location/2" }, quantities: [{ name: "available", quantity: 9 }] },
];

describe("selectStockOnHand", () => {
  it("uses the configured location's available quantity when set", () => {
    expect(selectStockOnHand(levels, "gid://shopify/Location/2")).toBe(9);
  });

  it("falls back to the first reported location when nothing is configured", () => {
    expect(selectStockOnHand(levels)).toBe(3);
  });

  it("returns 0 when the configured location isn't among the reported levels", () => {
    expect(selectStockOnHand(levels, "gid://shopify/Location/9")).toBe(0);
  });

  it("returns 0 for an item with no reported levels", () => {
    expect(selectStockOnHand([], "gid://shopify/Location/1")).toBe(0);
  });
});
