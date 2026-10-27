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
      metafieldTranslations: {
        pt: { "custom::care_instructions": "Manter seco." },
      },
      media: [{
        id: "m1",
        alt: " Front ",
        status: "READY",
        mediaContentType: "IMAGE",
        originalSource: { url: "https://storage.googleapis.com/a.jpg?token=x" },
        preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=1", width: 100, height: 80 } },
      }],
      metafields: [{ namespace: "custom", key: "x", value: "1", definition: { name: "X" } }],
      variants: { pageInfo: { hasNextPage: false, endCursor: "c" }, nodes: [] },
    });

    expect(canonical).toEqual({
      media: [
        {
          filename: "a.jpg",
          alt: "Front",
          position: 0,
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
    expect(canonical).not.toHaveProperty("metafieldTranslations");
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
      variants: [{ id: "v1", price: 12, taxable: false }],
    });
  });

  it("equates money decimals, blank strings, and weight units", () => {
    expect(diffShopifyProjections(
      { variants: [{ id: "v1", price: "5.0", compareAtPrice: "10.00", inventoryItem: {
        unitCost: { amount: "5.00", currencyCode: "EUR" },
        measurement: { weight: { value: 1, unit: "KILOGRAMS" } },
      } }] },
      { variants: [{ id: "v1", price: "5.00", compareAtPrice: "10.0", inventoryItem: {
        unitCost: { amount: "5.0", currencyCode: "EUR" },
        measurement: { weight: { value: 1000, unit: "GRAMS" } },
      } }] },
    )).toEqual([]);
  });

  it("equates null / undefined / whitespace", () => {
    expect(diffShopifyProjections(
      { vendor: "", productType: "  ", seo: { title: null }, barcode: undefined },
      { vendor: null, productType: null, seo: { title: "" }, barcode: null },
    )).toEqual([]);
  });

  it("keeps UNLISTED distinct from ACTIVE", () => {
    expect(canonicalizeShopifyProjection({ status: "UNLISTED" })).toEqual({
      status: "UNLISTED",
    });
    expect(canonicalizeShopifyProjection({ status: "ACTIVE" })).toEqual({
      status: "ACTIVE",
    });
  });
});

describe("diffShopifyProjections", () => {
  it("emits one leaf when canonical values differ but display strings match (number vs string)", () => {
    const diffs = diffShopifyProjections(
      { position: 1 },
      { position: "1" },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe("position");
    expect(diffs[0]?.local).toBe(diffs[0]?.shopify);
  });

  it("emits one leaf when boolean false differs from string No", () => {
    const diffs = diffShopifyProjections(
      { taxable: false },
      { taxable: "No" },
    );
    expect(diffs).toHaveLength(1);
    expect(diffs[0]?.path).toBe("taxable");
    expect(diffs[0]?.local).toBe("No");
    expect(diffs[0]?.shopify).toBe("No");
  });

  it("flags UNLISTED vs ACTIVE as one Status conflict", () => {
    const diffs = diffShopifyProjections(
      { status: "UNLISTED" },
      { status: "ACTIVE" },
    );
    expect(diffs).toEqual([
      {
        path: "status",
        field: "Status",
        local: "UNLISTED",
        shopify: "ACTIVE",
      },
    ]);
  });

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

  it("same photo re-hosted (new CDN url, size, id) → zero media diffs", () => {
    const diffs = diffShopifyProjections(
      {
        media: [{
          id: "gid://shopify/MediaImage/local",
          alt: "Ring",
          status: "READY",
          mediaContentType: "IMAGE",
          preview: {
            image: {
              url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=1",
              width: 400,
              height: 400,
            },
          },
        }],
      },
      {
        media: [{
          id: "gid://shopify/MediaImage/remote-new",
          alt: "Ring",
          status: "READY",
          mediaContentType: "IMAGE",
          originalSource: { url: "https://storage.googleapis.com/staged/ring-uuid.jpg?X-Goog=sig" },
          image: {
            url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=99",
            width: 2048,
            height: 2048,
          },
          preview: {
            image: {
              url: "https://cdn.shopify.com/s/files/1/ring-uuid.jpg?v=99&width=100",
              width: 100,
              height: 100,
            },
          },
        }],
      },
    );
    expect(diffs).toEqual([]);
  });

  it("different filename → one part at the image position", () => {
    const diffs = diffShopifyProjections(
      {
        media: [{
          id: "m1",
          alt: "Front",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
        }],
      },
      {
        media: [{
          id: "m2",
          alt: "Front",
          preview: { image: { url: "https://cdn.shopify.com/b.jpg" } },
        }],
      },
    );
    expect(diffs).toEqual([
      {
        path: "media[0]",
        field: "Image 1",
        local: "a.jpg (Front)",
        shopify: "b.jpg (Front)",
      },
    ]);
  });

  it("alt change → one part at the image position", () => {
    const diffs = diffShopifyProjections(
      {
        media: [{
          id: "m1",
          alt: "Front",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
        }],
      },
      {
        media: [{
          id: "m1",
          alt: "Side",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=2" } },
        }],
      },
    );
    expect(diffs).toEqual([
      {
        path: "media[0]",
        field: "Image 1",
        local: "a.jpg (Front)",
        shopify: "a.jpg (Side)",
      },
    ]);
  });

  it("order change → one part per affected image position (not subfields)", () => {
    const diffs = diffShopifyProjections(
      {
        media: [
          { id: "m1", alt: "A", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } },
          { id: "m2", alt: "B", preview: { image: { url: "https://cdn.shopify.com/b.jpg" } } },
        ],
      },
      {
        media: [
          { id: "m2", alt: "B", preview: { image: { url: "https://cdn.shopify.com/b.jpg" } } },
          { id: "m1", alt: "A", preview: { image: { url: "https://cdn.shopify.com/a.jpg" } } },
        ],
      },
    );
    expect(diffs).toEqual([
      {
        path: "media[0]",
        field: "Image 1",
        local: "a.jpg (A)",
        shopify: "b.jpg (B)",
      },
      {
        path: "media[1]",
        field: "Image 2",
        local: "b.jpg (B)",
        shopify: "a.jpg (A)",
      },
    ]);
    expect(diffs.every((d) => /^media\[\d+\]$/.test(d.path))).toBe(true);
  });

  it("extra or missing image → one part at that position", () => {
    const missing = diffShopifyProjections(
      { media: [] },
      {
        media: [{
          id: "gid://shopify/MediaImage/1",
          alt: null,
          preview: { image: { url: "https://cdn.shopify.com/ChatGPTImage.png?v=1" } },
        }],
      },
    );
    expect(missing).toEqual([
      {
        path: "media[0]",
        field: "Image 1 exists only in Shopify, not in Synarava",
        local: "—",
        shopify: "ChatGPTImage.png",
      },
    ]);

    const extra = diffShopifyProjections(
      {
        media: [{
          id: "local-1",
          preview: { image: { url: "https://cdn.example/ring.jpg" } },
        }],
      },
      { media: [] },
    );
    expect(extra).toEqual([
      {
        path: "media[0]",
        field: "Image 1 exists only in Synarava, not in Shopify",
        local: "ring.jpg",
        shopify: "—",
      },
    ]);
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
        local: "10",
        shopify: "12",
      },
    ]);
  });

  it("summarizes media gallery diffs instead of dumping GraphQL JSON", () => {
    const diffs = diffShopifyProjections(
      { media: [] },
      {
        media: [{
          id: "gid://shopify/MediaImage/1",
          originalSource: { url: "https://storage.googleapis.com/secret/ChatGPTImage.png" },
          preview: { image: { url: "https://cdn.shopify.com/ChatGPTImage.png?v=1" } },
        }],
      },
    );
    expect(diffs).toEqual([
      {
        path: "media[0]",
        field: "Image 1 exists only in Shopify, not in Synarava",
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
        field: "Overall length (synarava)",
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
    expect(labelForShopifyProjectionPath("media[0].preview.image.url")).toBe("Image 1");
    expect(labelForShopifyProjectionPath("media")).toBe("Media gallery");
  });

  it("states Synarava-only media clearly for the resolver", () => {
    const diffs = diffShopifyProjections(
      {
        media: [{
          id: "local-1",
          preview: { image: { url: "https://cdn.example/ring.jpg" } },
        }],
      },
      { media: [] },
    );
    expect(diffs).toContainEqual({
      path: "media[0]",
      field: "Image 1 exists only in Synarava, not in Shopify",
      local: "ring.jpg",
      shopify: "—",
    });
  });

  it("GraphQL media.nodes connection canonicalizes like a flat media array", () => {
    expect(canonicalizeShopifyProjection({
      media: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{
          id: "gid://shopify/MediaImage/1",
          alt: " Front ",
          preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=9", width: 10, height: 10 } },
        }],
      },
    })).toEqual({
      media: [{
        filename: "a.jpg",
        alt: "Front",
        position: 0,
        id: "gid://shopify/MediaImage/1",
        preview: { image: { url: "https://cdn.shopify.com/a.jpg" } },
      }],
    });
  });
});


describe("product metafield compare regression", () => {
  it("uses namespace/key identity and omits Shopify-generated IDs and empty values", () => {
    const fields = ["care_instructions", "finish", "material"].map((key) => ({
      namespace: "custom", key, type: "single_line_text_field", value: "same",
    }));
    expect(diffShopifyProjections(
      { metafields: [...fields, { namespace: "custom", key: "wrist_fit", type: "single_line_text_field", value: "" }] },
      { metafields: fields.toReversed().map((field, index) => ({ ...field, id: `gid://shopify/Metafield/${index}` })) },
    )).toEqual([]);
    expect(diffShopifyProjections(
      { metafields: fields },
      { metafields: fields.map((field) => field.key === "care_instructions" ? { ...field, value: "changed" } : field) },
    )).toHaveLength(1);
  });
});


it("does not compare different metafields when an entry is removed", () => {
  const fields = ["care", "finish", "material"].map((key) => ({ namespace: "custom", key, type: "single_line_text_field", value: key }));
  const differences = diffShopifyProjections({ metafields: fields }, { metafields: fields.slice(1) });
  expect(differences).toHaveLength(1);
  expect(differences[0].field).toBe("Care (custom)");
});

it("labels legacy Shopify SEO metafields for people", () => {
  expect(diffShopifyProjections(
    { metafields: [{ namespace: "global", key: "title_tag", value: "Our title" }] },
    { metafields: [{ namespace: "global", key: "title_tag", value: "Shopify title" }] },
  )).toEqual([{ path: "metafields.global::title_tag.value", field: "SEO title", local: "Our title", shopify: "Shopify title" }]);
});


it("treats Shopify null SEO overrides as the empty editor value", () => {
  expect(diffShopifyProjections({ seo: { title: "", description: "" } }, { seo: { title: null, description: null } })).toEqual([]);
});

it("treats bare Shopify span wrappers and dir attrs as equal descriptionHtml", () => {
  expect(diffShopifyProjections(
    { descriptionHtml: "<p>x</p>" },
    { descriptionHtml: "<p><span>x</span></p>" },
  )).toEqual([]);
  expect(diffShopifyProjections(
    { descriptionHtml: "<p>x</p>" },
    { descriptionHtml: '<p dir="ltr">x</p>' },
  )).toEqual([]);
});

it("still conflicts when descriptionHtml text actually changes", () => {
  expect(diffShopifyProjections(
    { descriptionHtml: "<p>x</p>" },
    { descriptionHtml: "<p><span>y</span></p>" },
  )).toEqual([
    { path: "descriptionHtml", field: "Description", local: "<p>x</p>", shopify: "<p>y</p>" },
  ]);
});


it("reports one SEO conflict rather than its duplicate global metafield view", () => {
  const window = (title: string) => ({ seo: { title, description: "" }, metafields: [{ namespace: "global", key: "title_tag", value: title, type: "single_line_text_field" }] });
  expect(diffShopifyProjections(window("Our title"), window("Shopify title"))).toEqual([
    { path: "seo.title", field: "SEO title", local: "Our title", shopify: "Shopify title" },
  ]);
});

it("normalizes ID noise and SEO aliases in an already-saved identity map", () => {
  const local = { seo: { title: "Our title", description: "" }, metafields: {
    "global::title_tag": { namespace: "global", key: "title_tag", value: "Old title" },
    "custom::care": { namespace: "custom", key: "care", value: "Dry" },
  } };
  const remote = { seo: { title: "Our title", description: null }, metafields: [
    { namespace: "custom", key: "care", value: "Dry", id: "gid://shopify/Metafield/1" },
  ] };
  expect(diffShopifyProjections(local, remote)).toEqual([]);
});
