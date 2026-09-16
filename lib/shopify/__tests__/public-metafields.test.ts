import { describe, expect, it } from "vitest";

import { projectPublicProductMetafields } from "@/lib/shopify/public-metafields";

describe("projectPublicProductMetafields", () => {
  it("shows public merchant facts without leaking private or opaque values", () => {
    expect(projectPublicProductMetafields([
      { namespace: "custom", key: "pearl_grade", type: "single_line_text_field", value: "AAA", definition: { name: "Pearl grade", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "custom", key: "internal_note", type: "single_line_text_field", value: "private", definition: { name: "Internal note", access: { storefront: "NONE" } } },
      { namespace: "custom", key: "stone", type: "metaobject_reference", value: "gid://shopify/Metaobject/1", definition: { name: "Stone", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "synarava", key: "material", type: "single_line_text_field", value: "Pearl", definition: { name: "Material", access: { storefront: "PUBLIC_READ" } } },
      { namespace: "custom", key: "made_to_order", type: "boolean", value: "false", definition: { name: "Made to order", access: { storefront: "PUBLIC_READ" } } },
    ])).toEqual([
      { label: "Pearl grade", value: "AAA" },
      { label: "Made to order", value: "No" },
    ]);
  });
});
