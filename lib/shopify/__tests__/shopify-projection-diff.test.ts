import { describe, expect, it } from "vitest";

import {
  alignMetafieldResolvedValues,
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
      media: [{
        id: "m1",
        status: "READY",
        originalSource: { url: "https://storage.googleapis.com/signed?token=x" },
        preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=1" } },
      }],
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
      metafields: {
        "custom::x": { key: "x", namespace: "custom", value: "1" },
      },
      title: "Ring",
      variants: { nodes: [] },
    });
  });

  it("maps metafields by namespace::key regardless of array order", () => {
    const a = canonicalizeShopifyProjection({
      metafields: [
        { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
        { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
      ],
    });
    const b = canonicalizeShopifyProjection({
      metafields: [
        { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
        { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
      ],
    });
    expect(a).toEqual(b);
    expect(a).toEqual({
      metafields: {
        "synarava::neck_fit": {
          key: "neck_fit",
          namespace: "synarava",
          type: "single_line_text_field",
          value: "16",
        },
        "synarava::overall_length": {
          key: "overall_length",
          namespace: "synarava",
          type: "single_line_text_field",
          value: "18",
        },
      },
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
    expect(diffs).toEqual([
      {
        path: "variants[0].price",
        field: "Price",
        local: "10.00",
        shopify: "12.00",
      },
    ]);
  });

  it("summarizes media gallery diffs instead of dumping GraphQL JSON", () => {
    const diffs = diffShopifyProjections(
      { media: [] },
      {
        media: [{
          id: "gid://shopify/MediaImage/1",
          originalSource: { url: "https://storage.googleapis.com/secret" },
          preview: { image: { url: "https://cdn.shopify.com/ChatGPTImage.png?v=1" } },
        }],
      },
    );
    expect(diffs).toEqual([
      {
        path: "media[0]",
        field: "Media gallery (image 1)",
        local: "—",
        shopify: "ChatGPTImage.png",
      },
    ]);
  });

  it("clears phantom empty-OUR conflicts after aligning category resolvedValues", () => {
    const working = {
      metafields: [{
        namespace: "shopify",
        key: "finish",
        type: "list.product_taxonomy_value_reference",
        value: "[\"gid://shopify/TaxonomyValue/1\"]",
      }],
    };
    const shopify = {
      metafields: [{
        namespace: "shopify",
        key: "finish",
        type: "list.product_taxonomy_value_reference",
        value: "[\"gid://shopify/TaxonomyValue/1\"]",
        resolvedValues: ["18K Gold PVD"],
      }],
    };

    expect(diffShopifyProjections(working, shopify).length).toBeGreaterThan(0);
    const aligned = alignMetafieldResolvedValues(working, shopify);
    expect(diffShopifyProjections(aligned, shopify)).toEqual([]);
  });

  it("does not invent missing metafields when aligning resolvedValues", () => {
    const working = { metafields: [] };
    const shopify = {
      metafields: [{
        namespace: "shopify",
        key: "finish",
        type: "list.product_taxonomy_value_reference",
        value: "[\"gid://shopify/TaxonomyValue/1\"]",
        resolvedValues: ["White / gold"],
      }],
    };
    expect(alignMetafieldResolvedValues(working, shopify)).toEqual(working);
    expect(diffShopifyProjections(working, shopify).length).toBeGreaterThan(0);
  });

  it("same metafields different order → zero conflicts", () => {
    const local = {
      metafields: [
        { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
        { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
        { namespace: "synarava", key: "wrist_fit", type: "single_line_text_field", value: "7" },
      ],
    };
    const shopify = {
      metafields: [
        { namespace: "synarava", key: "wrist_fit", type: "single_line_text_field", value: "7" },
        { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
        { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
      ],
    };
    expect(diffShopifyProjections(local, shopify)).toEqual([]);
  });

  it("real metafield value mismatch → one identity-keyed conflict", () => {
    const diffs = diffShopifyProjections(
      {
        metafields: [
          { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
          { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
        ],
      },
      {
        metafields: [
          { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "20" },
          { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
        ],
      },
    );
    expect(diffs).toEqual([
      {
        path: "metafields.synarava::overall_length.value",
        field: "Metafield synarava.overall_length.value",
        local: "18",
        shopify: "20",
      },
    ]);
  });

  it("inventory-only change does not invent metafield index paths", () => {
    const sharedMetafields = [
      { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
      { namespace: "synarava", key: "overall_length", type: "single_line_text_field", value: "18" },
      { namespace: "shopify", key: "jewelry-material", type: "list.product_taxonomy_value_reference", value: "[]" },
    ];
    const diffs = diffShopifyProjections(
      {
        totalInventory: 4,
        metafields: sharedMetafields,
        variants: [{ id: "v1", inventoryQuantity: 4 }],
      },
      {
        totalInventory: 1,
        metafields: [...sharedMetafields].reverse(),
        variants: [{ id: "v1", inventoryQuantity: 1 }],
      },
    );
    expect(diffs.map((item) => item.path).toSorted()).toEqual([
      "totalInventory",
      "variants[0].inventoryQuantity",
    ]);
    expect(diffs.every((item) => !item.path.includes("metafields["))).toBe(true);
  });

  it("extra metafield on one side is a single identity path, not an index cascade", () => {
    const diffs = diffShopifyProjections(
      {
        metafields: [
          { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
          { namespace: "shopify", key: "jewelry-material", type: "list.product_taxonomy_value_reference", value: "[]" },
        ],
      },
      {
        metafields: [
          { namespace: "synarava", key: "neck_fit", type: "single_line_text_field", value: "16" },
        ],
      },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe("metafields.shopify::jewelry-material");
    expect(diffs.every((item) => !/^metafields\[\d+\]/.test(item.path))).toBe(true);
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
    expect(labelForShopifyProjectionPath("media[0].preview.image.url")).toBe("Media gallery (image 1)");
    expect(labelForShopifyProjectionPath("media")).toBe("Media gallery");
  });
});
