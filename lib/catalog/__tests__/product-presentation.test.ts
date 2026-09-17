import { describe, expect, it } from "vitest";

import {
  getProductBreadcrumbs,
  getProductPresentation,
} from "@/lib/catalog/product-presentation";

// Identity stub: asserts on which translation key was requested rather than a
// specific locale's copy, so this stays a test of the department/breadcrumb
// logic (REV-23 made both functions locale-aware via an injected `t`).
const t = (key: string) => key;

describe("product presentation", () => {
  it("provides department-specific buying guidance", () => {
    expect(getProductPresentation("pets", t).buyingTitle).toBe("product.presentation.pets.buyingTitle");
    expect(getProductPresentation("kids", t).priorityCharacteristicKeys).toContain("recommended_age");
    expect(getProductPresentation("jewelry-making", t).priorityCharacteristicKeys).toContain("tool_compatibility");
  });

  it("falls back to jewelry's presentation for a department with none of its own", () => {
    expect(getProductPresentation(null, t).buyingTitle).toBe("product.presentation.jewelry.buyingTitle");
  });

  it("builds a filter-backed Department → Category → Product breadcrumb", () => {
    expect(getProductBreadcrumbs({
      title: "Woven Collar",
      departmentSlug: "pets",
      departmentName: "Pets",
      categorySlug: "collars",
      categoryName: "Collars",
    }, t)).toEqual([
      { label: "nav.shop", href: "/shop" },
      { label: "Pets", href: "/shop?department=pets" },
      { label: "Collars", href: "/shop?department=pets&category=collars" },
      { label: "Woven Collar" },
    ]);
  });
});
