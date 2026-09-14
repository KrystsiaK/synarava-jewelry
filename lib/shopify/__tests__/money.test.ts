import { discountPercent, shopifyAmountToCents } from "../money";

describe("shopifyAmountToCents", () => {
  it("converts a decimal-string amount to integer cents", () => {
    expect(shopifyAmountToCents("24.50")).toBe(2450);
    expect(shopifyAmountToCents("1")).toBe(100);
  });

  it("rounds rather than truncates on floating-point noise", () => {
    expect(shopifyAmountToCents("19.999999999999996")).toBe(2000);
  });

  it("treats null, undefined, and non-numeric strings as zero", () => {
    expect(shopifyAmountToCents(null)).toBe(0);
    expect(shopifyAmountToCents(undefined)).toBe(0);
    expect(shopifyAmountToCents("not a number")).toBe(0);
  });
});

describe("discountPercent", () => {
  it("rounds the percentage off between compare-at and price", () => {
    expect(discountPercent(80, 100)).toBe(20);
    expect(discountPercent(66, 100)).toBe(34);
  });

  it("returns null when there is no compare-at price or no real discount", () => {
    expect(discountPercent(100, null)).toBeNull();
    expect(discountPercent(100, 100)).toBeNull();
    expect(discountPercent(100, 80)).toBeNull();
  });
});
