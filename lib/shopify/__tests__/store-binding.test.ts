import { describe, expect, it } from "vitest";

import { classifyShopifyStoreBinding } from "@/lib/shopify/store-binding";

describe("Shopify store binding", () => {
  it("initializes an unbound installation", () => {
    expect(classifyShopifyStoreBinding(null, "New-Shop.myshopify.com/"))
      .toEqual({ status: "UNBOUND", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("accepts the same canonical shop domain", () => {
    expect(classifyShopifyStoreBinding("new-shop.myshopify.com", "https://NEW-SHOP.myshopify.com"))
      .toEqual({ status: "MATCH", currentShopDomain: "new-shop.myshopify.com" });
  });

  it("requires an explicit rebind for a duplicated store", () => {
    expect(classifyShopifyStoreBinding("old-shop.myshopify.com", "new-shop.myshopify.com"))
      .toEqual({
        status: "MISMATCH",
        boundShopDomain: "old-shop.myshopify.com",
        currentShopDomain: "new-shop.myshopify.com",
      });
  });
});
