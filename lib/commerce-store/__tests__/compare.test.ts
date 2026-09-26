import { describe, expect, it } from "vitest";

import { compareCommerceStores } from "@/lib/commerce-store/compare";
import {
  emptyCommerceStore,
  productStoreKey,
  setProductWindow,
} from "@/lib/commerce-store/types";

describe("commerce-store compare", () => {
  it("reports no conflicts when windows match", () => {
    const window = { title: "Ring", variants: [{ price: "10.00" }] };
    const our = setProductWindow(emptyCommerceStore(), "gid://shopify/Product/1", window);
    const shopify = setProductWindow(emptyCommerceStore(), "gid://shopify/Product/1", window);
    expect(compareCommerceStores(our, shopify)).toEqual([]);
  });

  it("reports field diffs when windows diverge", () => {
    const our = setProductWindow(emptyCommerceStore(), "gid://shopify/Product/1", {
      title: "Local",
      variants: [{ price: "11.00" }],
    });
    const shopify = setProductWindow(emptyCommerceStore(), "gid://shopify/Product/1", {
      title: "Remote",
      variants: [{ price: "10.00" }],
    });
    const conflicts = compareCommerceStores(our, shopify);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]?.key).toBe("gid://shopify/Product/1");
    expect(conflicts[0]?.differences.some((d) => d.path.includes("title") || d.field.toLowerCase().includes("title"))).toBe(true);
  });

  it("reports presence for only-in-shopify / only-in-our", () => {
    const our = setProductWindow(emptyCommerceStore(), "local:p1", { title: "Draft" });
    const shopify = setProductWindow(emptyCommerceStore(), "gid://shopify/Product/2", { title: "Live" });
    const conflicts = compareCommerceStores(our, shopify);
    expect(conflicts.map((c) => c.key).toSorted()).toEqual([
      "gid://shopify/Product/2",
      "local:p1",
    ]);
    expect(conflicts.every((c) => c.differences[0]?.path === "_presence")).toBe(true);
  });

  it("productStoreKey prefers shopify GID", () => {
    expect(productStoreKey({ shopifyProductId: "gid://shopify/Product/9", localProductId: "x" }))
      .toBe("gid://shopify/Product/9");
    expect(productStoreKey({ shopifyProductId: null, localProductId: "x" })).toBe("local:x");
  });

  it("setProductWindow is immutable", () => {
    const a = emptyCommerceStore();
    const b = setProductWindow(a, "k", { title: "A" });
    expect(a.products).toEqual({});
    expect(b.products.k).toEqual({ title: "A" });
  });
});
