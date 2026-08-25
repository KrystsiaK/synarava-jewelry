import { describe, expect, it } from "vitest";

import {
  getProductBreadcrumbs,
  getProductPresentation,
} from "@/lib/catalog/product-presentation";

describe("product presentation", () => {
  it("provides department-specific buying guidance", () => {
    expect(getProductPresentation("pets").buyingTitle).toBe("Choose the right fit");
    expect(getProductPresentation("kids").priorityCharacteristicKeys).toContain("recommended_age");
    expect(getProductPresentation("jewelry-making").priorityCharacteristicKeys).toContain("tool_compatibility");
  });

  it("builds a filter-backed Department → Category → Product breadcrumb", () => {
    expect(getProductBreadcrumbs({
      title: "Woven Collar",
      departmentSlug: "pets",
      departmentName: "Pets",
      categorySlug: "collars",
      categoryName: "Collars",
    })).toEqual([
      { label: "Shop", href: "/shop" },
      { label: "Pets", href: "/shop?department=pets" },
      { label: "Collars", href: "/shop?department=pets&category=collars" },
      { label: "Woven Collar" },
    ]);
  });
});
