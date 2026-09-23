import { describe, expect, it } from "vitest";

import {
  getProductBreadcrumbs,
  getProductPresentation,
} from "@/lib/catalog/product-presentation";

// Identity stub: asserts on which translation key was requested rather than a
// specific locale's copy, so this stays a test of breadcrumb logic (REV-23).
const t = (key: string) => key;

describe("product presentation", () => {
  it("provides jewelry storefront buying guidance", () => {
    expect(getProductPresentation(t).buyingTitle).toBe("product.presentation.jewelry.buyingTitle");
    expect(getProductPresentation(t).priorityCharacteristicKeys).toContain("chain_length");
  });

  it("builds a filter-backed Shop → Category → Product breadcrumb", () => {
    expect(getProductBreadcrumbs({
      title: "Heritage Bracelet",
      categorySlug: "bracelets",
      categoryName: "Bracelets",
    }, t)).toEqual([
      { label: "nav.shop", href: "/shop" },
      { label: "Bracelets", href: "/shop?category=bracelets" },
      { label: "Heritage Bracelet" },
    ]);
  });
});
