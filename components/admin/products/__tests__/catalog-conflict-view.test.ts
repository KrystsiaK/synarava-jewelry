import { describe, expect, it } from "vitest";

import {
  isProductTypeConflictField,
  productTypeApplyImpactNote,
} from "@/components/admin/products/catalog-conflict-view";

describe("catalog-conflict-view product-type Apply confirm", () => {
  it("recognizes product type conflict fields", () => {
    expect(isProductTypeConflictField({ label: "Product type", fieldKey: "commerce:productType" })).toBe(true);
    expect(isProductTypeConflictField({ label: "Title", fieldKey: "translation:ru:title" })).toBe(false);
  });

  it("builds affects-N-products confirm copy for the one Apply path", () => {
    expect(productTypeApplyImpactNote(1)).toBe(
      "Product type is a shared label — confirming affects 1 product that uses this type name.",
    );
    expect(productTypeApplyImpactNote(3)).toBe(
      "Product type is a shared label — confirming affects 3 products that use this type name.",
    );
  });
});
