import { describe, expect, it } from "vitest";

import {
  canonicalizeShopifyProjection,
  diffShopifyProjections,
  getProjectionPath,
  labelForShopifyProjectionPath,
  setProjectionPath,
} from "@/lib/shopify/shopify-projection-diff";

describe("canonicalizeShopifyProjection", () => {
  it("strips technical keys and media status / metafield definition", () => {
    const canonical = canonicalizeShopifyProjection({
      title: "Ring",
      updatedAt: "2026-01-01T00:00:00Z",
      __typename: "Product",
      media: [{ id: "m1", status: "READY", preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=1" } } }],
      metafields: [{ namespace: "custom", key: "x", value: "1", definition: { name: "X" } }],
      variants: { pageInfo: { hasNextPage: false, endCursor: "c" }, nodes: [] },
    });

    expect(canonical).toEqual({
      media: [
        {
          id: "m1",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
        },
      ],
      metafields: [{ key: "x", namespace: "custom", value: "1" }],
      title: "Ring",
      variants: { nodes: [] },
    });
  });

  it("does not omit taxable, status, or prices", () => {
    const canonical = canonicalizeShopifyProjection({
      status: "ACTIVE",
      variants: [{ id: "v1", price: "12.00", taxable: false }],
    });
    expect(canonical).toEqual({
      status: "ACTIVE",
      variants: [{ id: "v1", price: "12.00", taxable: false }],
    });
  });
});

describe("diffShopifyProjections", () => {
  it("flags taxable mismatches", () => {
    const diffs = diffShopifyProjections(
      { variants: [{ id: "v1", taxable: true, price: "10.00" }] },
      { variants: [{ id: "v1", taxable: false, price: "10.00" }] },
    );
    expect(diffs).toEqual([
      {
        path: "variants[0].taxable",
        field: "Charge tax",
        local: "Yes",
        shopify: "No",
      },
    ]);
  });

  it("ignores CDN query churn and updatedAt alone", () => {
    const diffs = diffShopifyProjections(
      {
        updatedAt: "2026-01-01T00:00:00Z",
        media: [{ id: "m1", preview: { image: { url: "https://cdn.shopify.com/x.jpg?v=1" } } }],
      },
      {
        updatedAt: "2026-01-02T00:00:00Z",
        media: [{ id: "m1", preview: { image: { url: "https://cdn.shopify.com/x.jpg?v=99" } } }],
      },
    );
    expect(diffs).toEqual([]);
  });

  it("flags price mismatches with Shopify-shaped amounts", () => {
    const diffs = diffShopifyProjections(
      { variants: [{ id: "v1", price: "10.00" }] },
      { variants: [{ id: "v1", price: "12.00" }] },
    );
    expect(diffs[0]).toMatchObject({
      path: "variants[0].price",
      field: "Price",
      local: "10.00",
      shopify: "12.00",
    });
  });
});

describe("projection path helpers", () => {
  it("gets and sets nested paths", () => {
    const root = { variants: [{ id: "v1", taxable: true }] };
    expect(getProjectionPath(root, "variants[0].taxable")).toBe(true);
    expect(setProjectionPath(root, "variants[0].taxable", false)).toEqual({
      variants: [{ id: "v1", taxable: false }],
    });
    expect(root).toEqual({ variants: [{ id: "v1", taxable: true }] });
  });

  it("labels known paths", () => {
    expect(labelForShopifyProjectionPath("vendor")).toBe("Vendor");
    expect(labelForShopifyProjectionPath("variants[0].taxable")).toBe("Charge tax");
  });
});
