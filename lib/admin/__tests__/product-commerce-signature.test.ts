import { describe, expect, it } from "vitest";

import { productCommerceSignature } from "@/lib/admin/product-commerce-signature";

function product(shopifyCategoryId: string | null) {
  return {
    name: "Lava Ring",
    slug: "lava-ring",
    description: null,
    imageUrl: null,
    shopifyCategoryId,
    media: [],
    status: "DRAFT" as const,
    visibility: "PRIVATE" as const,
    sku: "RING-1",
    priceCents: 12000,
    variants: [],
    tags: [],
    characteristics: [],
  };
}

describe("productCommerceSignature", () => {
  it("treats a Shopify taxonomy category change as a commerce change", () => {
    expect(productCommerceSignature(product("gid://shopify/TaxonomyCategory/aa-1"))).not.toBe(
      productCommerceSignature(product("gid://shopify/TaxonomyCategory/aa-2")),
    );
  });
});
