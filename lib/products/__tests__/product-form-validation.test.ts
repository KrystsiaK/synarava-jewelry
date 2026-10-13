import {
  firstProductFieldError,
  PRODUCT_FIELD_SECTION,
  PRODUCT_FIELD_VISUAL_ORDER,
  validateProductInput,
} from "../product-form-validation";

describe("validateProductInput", () => {
  it("returns a specific error for every required commerce field", () => {
    expect(validateProductInput({ name: "", slug: "", sku: "", price: "" })).toEqual({
      name: "Enter a product name.",
      slug: "Enter a URL slug.",
      sku: "Enter an SKU.",
      price: "Enter a price greater than 0.",
    });
  });

  it.each(["0", "-1", "not-a-number"])("rejects invalid price %s", (price) => {
    expect(validateProductInput({ name: "Ring", slug: "ring", sku: "R-1", price })).toEqual({
      price: "Enter a price greater than 0.",
    });
  });

  it("accepts a complete product core", () => {
    expect(validateProductInput({ name: " Ring ", slug: "ring", sku: "R-1", price: "125.50" })).toEqual({});
  });
});

describe("firstProductFieldError", () => {
  it("picks the first failing field in visual tab order, not object-key order", () => {
    expect(firstProductFieldError({
      sku: "Enter an SKU.",
      price: "Enter a price greater than 0.",
      name: "Enter a product name.",
    })).toBe("name");
    expect(firstProductFieldError({
      sku: "Enter an SKU.",
      price: "Enter a price greater than 0.",
    })).toBe("price");
    expect(firstProductFieldError({ sku: "Enter an SKU." })).toBe("sku");
  });

  it("maps fields onto Product / Price / Inventory sections", () => {
    expect(PRODUCT_FIELD_SECTION[firstProductFieldError({ name: "x" })!]).toBe("essentials");
    expect(PRODUCT_FIELD_SECTION[firstProductFieldError({ price: "x" })!]).toBe("price");
    expect(PRODUCT_FIELD_SECTION[firstProductFieldError({ sku: "x" })!]).toBe("inventory");
    expect(PRODUCT_FIELD_VISUAL_ORDER).toEqual([
      "name",
      "slug",
      "collectionSlug",
      "price",
      "sku",
    ]);
  });
});
