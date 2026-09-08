import { hasDepartmentTranslation } from "../taxonomy";

describe("hasDepartmentTranslation", () => {
  it("accepts every legacy department slug", () => {
    expect(hasDepartmentTranslation("jewelry")).toBe(true);
    expect(hasDepartmentTranslation("pets")).toBe(true);
    expect(hasDepartmentTranslation("kids")).toBe(true);
    expect(hasDepartmentTranslation("jewelry-making")).toBe(true);
  });

  it("rejects a primary-nav collection with no translated label", () => {
    expect(hasDepartmentTranslation("home-goods")).toBe(false);
    expect(hasDepartmentTranslation(null)).toBe(false);
    expect(hasDepartmentTranslation(undefined)).toBe(false);
  });
});
