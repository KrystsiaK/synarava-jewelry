import { inferDepartment, isShopDepartmentSlug, shopDepartmentName } from "../taxonomy";

describe("inferDepartment", () => {
  it("trusts an explicit Shopify productType that already matches a department slug", () => {
    expect(inferDepartment({ productType: "Jewelry-Making", title: "Anything" })).toBe("jewelry-making");
  });

  it("classifies pet accessories from productType or title keywords", () => {
    expect(inferDepartment({ productType: "Accessories", title: "Leather Dog Collar" })).toBe("pets");
    expect(inferDepartment({ productType: "Pet Leash", title: "Oak handle lead" })).toBe("pets");
  });

  it("classifies kids' products from productType or title keywords", () => {
    expect(inferDepartment({ productType: "Toys", title: "Educational Toy Set" })).toBe("kids");
    expect(inferDepartment({ productType: "", title: "Wooden toy for children" })).toBe("kids");
  });

  it("classifies jewelry-making supplies from productType or title keywords", () => {
    expect(inferDepartment({ productType: "Supply", title: "Brass jump rings" })).toBe("jewelry-making");
    expect(inferDepartment({ productType: "", title: "Waxed cord for jewelry making" })).toBe("jewelry-making");
  });

  it("falls back to jewelry and warns when no signal matches", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = inferDepartment({ productType: "", title: "Coleira para cão" });

    expect(result).toBe("jewelry");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("Coleira para cão");

    warn.mockRestore();
  });

});

describe("isShopDepartmentSlug", () => {
  it("accepts every known department slug", () => {
    expect(isShopDepartmentSlug("jewelry")).toBe(true);
    expect(isShopDepartmentSlug("pets")).toBe(true);
    expect(isShopDepartmentSlug("kids")).toBe(true);
    expect(isShopDepartmentSlug("jewelry-making")).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isShopDepartmentSlug("home")).toBe(false);
    expect(isShopDepartmentSlug(undefined)).toBe(false);
    expect(isShopDepartmentSlug(42)).toBe(false);
  });
});

describe("shopDepartmentName", () => {
  it("looks up the display name for a known slug", () => {
    expect(shopDepartmentName("jewelry-making")).toBe("Jewelry Making");
  });

  it("returns an empty string for an unknown or missing slug", () => {
    expect(shopDepartmentName(null)).toBe("");
    expect(shopDepartmentName(undefined)).toBe("");
  });
});
