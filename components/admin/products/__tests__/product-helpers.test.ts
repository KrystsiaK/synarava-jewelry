import { describe, expect, it } from "vitest";

import {
  centsToPrice,
  emptyDraft,
  issuesForField,
  normalizeProducts,
  productActionCopy,
  productStatusLabel,
  productToDraft,
  sortProducts,
} from "@/components/admin/products/product-helpers";
import type { ProductRecord } from "@/components/admin/products/product-types";
import type { AdminIssueSummary } from "@/components/admin/shared/admin-issue-types";

function makeIssue(overrides: Partial<AdminIssueSummary>): AdminIssueSummary {
  return {
    id: "issue-1",
    key: "issue-1",
    entityType: "PRODUCT",
    entityId: "product-1",
    entityLabel: "Lava Ring",
    fieldPath: "field-imageUrl",
    issueType: "MISSING_FIELD",
    severity: "WARNING",
    status: "OPEN",
    title: "Missing image",
    description: "",
    targetHref: "/admin/products/product-1",
    firstSeenAt: new Date("2026-01-01"),
    lastSeenAt: new Date("2026-01-01"),
    resolvedAt: null,
    notificationSentAt: null,
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-01"),
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ProductRecord> = {}): ProductRecord {
  return {
    id: "product-1",
    createdAt: new Date("2026-01-01"),
    updatedAt: new Date("2026-01-02"),
    publishedAt: null,
    slug: "lava-ring",
    sku: "LAVA-1",
    name: "Lava Ring",
    seriesLabel: null,
    shortDescription: null,
    description: null,
    materialLine: null,
    symbolismLabel: null,
    symbolismTitle: null,
    symbolismBody: null,
    symbolismBody2: null,
    details: null,
    imageUrl: null,
    primaryAssetId: null,
    priceCents: 4500,
    status: "DRAFT",
    visibility: "PRIVATE",
    shopifyProductId: null,
    shopifyHandle: null,
    shopifyCategoryId: null,
    shopifyCategoryName: null,
    shopifyUpdatedAt: null,
    lastSyncedAt: null,
    syncStatus: "UNLINKED",
    syncError: null,
    media: [],
    characteristics: [],
    variants: [],
    collections: [],
    tags: [],
    ...overrides,
  } as ProductRecord;
}

describe("centsToPrice", () => {
  it("formats cents as a two-decimal price string", () => {
    expect(centsToPrice(4599)).toBe("45.99");
    expect(centsToPrice(0)).toBe("0.00");
  });
});

describe("normalizeProducts", () => {
  it("sorts products by name descending", () => {
    const products = [makeProduct({ name: "Alpha" }), makeProduct({ name: "Zeta" }), makeProduct({ name: "Mid" })];
    expect(normalizeProducts(products).map((item) => item.name)).toEqual(["Zeta", "Mid", "Alpha"]);
  });
});

describe("sortProducts", () => {
  const products = [
    makeProduct({ id: "a", name: "Alpha", priceCents: 1000, publishedAt: new Date("2026-01-01"), updatedAt: new Date("2026-02-01") }),
    makeProduct({ id: "b", name: "Beta", priceCents: 5000, publishedAt: null, updatedAt: new Date("2026-03-01") }),
    makeProduct({ id: "c", name: "Gamma", priceCents: 3000, publishedAt: new Date("2026-02-15"), updatedAt: new Date("2026-01-15") }),
  ];

  it("sorts unpublished products last when sorting by published", () => {
    expect(sortProducts(products, "published").map((item) => item.id)).toEqual(["c", "a", "b"]);
  });

  it("sorts by most recently updated", () => {
    expect(sortProducts(products, "updated").map((item) => item.id)).toEqual(["b", "a", "c"]);
  });

  it("sorts by name ascending and descending", () => {
    expect(sortProducts(products, "name-asc").map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(sortProducts(products, "name-desc").map((item) => item.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts by price ascending and descending", () => {
    expect(sortProducts(products, "price-asc").map((item) => item.id)).toEqual(["a", "c", "b"]);
    expect(sortProducts(products, "price-desc").map((item) => item.id)).toEqual(["b", "c", "a"]);
  });
});

describe("productStatusLabel", () => {
  it("labels archived products as ARCHIVED regardless of visibility", () => {
    expect(productStatusLabel(makeProduct({ status: "ARCHIVED", visibility: "PUBLIC" }))).toBe("ARCHIVED");
  });

  it("labels unlisted products as UNLISTED", () => {
    expect(productStatusLabel(makeProduct({ status: "UNLISTED", visibility: "UNLISTED" }))).toBe("UNLISTED");
  });

  it("labels active+public products as PUBLISHED", () => {
    expect(productStatusLabel(makeProduct({ status: "ACTIVE", visibility: "PUBLIC" }))).toBe("PUBLISHED");
  });

  it("falls back to DRAFT for active-but-private products", () => {
    expect(productStatusLabel(makeProduct({ status: "ACTIVE", visibility: "PRIVATE" }))).toBe("DRAFT");
  });
});

describe("productToDraft", () => {
  it("prefers the primary variant's commerce fields over the product's own mirror columns", () => {
    const product = makeProduct({
      priceCents: 1000,
      sku: "PRODUCT-SKU",
      variants: [
        {
          id: "variant-1",
          sku: "VARIANT-SKU",
          title: "Default",
          priceCents: 2500,
          compareAtCents: null,
          stockOnHand: 7,
          barcode: null,
          taxable: true,
          requiresShipping: true,
          tracked: true,
          weightGrams: null,
          imageUrl: null,
          selectedOptions: null,
          shopifyVariantId: null,
          shopifyInventoryItemId: null,
        },
      ],
    });

    const draft = productToDraft(product);
    expect(draft.sku).toBe("VARIANT-SKU");
    expect(draft.price).toBe("25.00");
    expect(draft.stockOnHand).toBe("7");
  });

  it("excludes the primary-nav (department) collection from the marketing collection slug", () => {
    const product = makeProduct({
      collections: [
        { id: "link-1", sortOrder: 0, collection: { id: "col-1", slug: "rings", isPrimaryNav: false, name: "Rings" } },
        { id: "link-2", sortOrder: 1, collection: { id: "col-2", slug: "jewelry", isPrimaryNav: true, name: "Jewelry" } },
      ],
    });

    expect(productToDraft(product).collectionSlug).toBe("rings");
  });

  it("derives workflowState from status and visibility", () => {
    expect(productToDraft(makeProduct({ status: "ACTIVE", visibility: "PUBLIC" })).workflowState).toBe("PUBLISHED");
    expect(productToDraft(makeProduct({ status: "UNLISTED", visibility: "UNLISTED" })).workflowState).toBe("UNLISTED");
    expect(productToDraft(makeProduct({ status: "DRAFT", visibility: "PRIVATE" })).workflowState).toBe("DRAFT");
  });
});

describe("emptyDraft", () => {
  it("returns a blank draft defaulting to DRAFT state", () => {
    expect(emptyDraft().workflowState).toBe("DRAFT");
    expect(emptyDraft().name).toBe("");
  });
});

describe("issuesForField", () => {
  it("filters to open issues matching the field path", () => {
    const issues = [
      makeIssue({ fieldPath: "field-imageUrl", status: "OPEN" }),
      makeIssue({ fieldPath: "field-imageUrl", status: "RESOLVED" }),
      makeIssue({ fieldPath: "field-other", status: "OPEN" }),
    ];
    expect(issuesForField(issues, "field-imageUrl")).toHaveLength(1);
  });
});

describe("productActionCopy", () => {
  it("returns danger tone copy for archive and delete actions", () => {
    const product = makeProduct({ name: "Lava Ring" });
    expect(productActionCopy({ product, action: "archive" }).tone).toBe("danger");
    expect(productActionCopy({ product, action: "delete" }).tone).toBe("danger");
    expect(productActionCopy({ product, action: "publish" }).tone).toBe("default");
    expect(productActionCopy({ product, action: "draft" }).title).toContain("Lava Ring");
  });
});
