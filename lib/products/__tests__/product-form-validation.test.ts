import { validateProductInput } from "../product-form-validation";

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
