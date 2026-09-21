import { describe, expect, it } from "vitest";

import {
  buildCoverageReport,
  collectionCoverage,
  pageCoverage,
  planBindingCreates,
  productCoverage,
  summarize,
} from "../lib/translation-coverage.mjs";

describe("translation coverage", () => {
  it("reports required product gaps and missing identity without false unsupported-field blockers", () => {
    const row = productCoverage({
      id: "product-1",
      sku: "RING-1",
      name: "Lava ring",
      shopifyProductId: null,
      translations: [{
        locale: "pt",
        title: "Anel Lava",
        shortDescription: "",
        description: "Descrição",
        materialLine: "Prata reciclada",
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        details: null,
        seoTitle: null,
        seoDescription: null,
        reviewStatus: "DRAFT",
      }],
    });

    expect(row).toMatchObject({
      entityType: "PRODUCT",
      entityId: "product-1",
      hasPt: true,
      reviewed: false,
      missingFields: ["shortDescription"],
      missingIdentity: true,
      unsupportedFields: [],
      translationComplete: false,
      enforcementReady: false,
    });
  });

  it("treats a reviewed collection with required PT copy and matching identity as translation-complete", () => {
    const row = collectionCoverage({
      id: "collection-1",
      name: "Rings",
      shopifyCollectionId: "gid://shopify/Collection/1",
      translations: [{
        locale: "pt",
        name: "Anéis",
        description: null,
        manifesto: null,
        symbolismLabel: null,
        symbolismTitle: null,
        symbolismBody: null,
        symbolismBody2: null,
        searchSummary: null,
        reviewStatus: "REVIEWED",
      }],
    });

    expect(row.translationComplete).toBe(true);
    expect(row.missingIdentity).toBe(false);
    expect(row.unsupportedFields).toEqual([]);
  });

  it("covers Page identities now that native Page sync is implemented", () => {
    const row = pageCoverage({
      id: "page-1",
      title: "About",
      shopifyPageId: "gid://shopify/Page/1",
      translations: [{ locale: "pt", title: "Sobre", reviewStatus: "REVIEWED" }],
    });

    expect(row).toMatchObject({
      entityType: "PAGE",
      translationComplete: true,
      missingIdentity: false,
      unsupportedFields: [],
    });
  });

  it("classifies bindings and creates only missing non-conflicting identities", () => {
    const report = buildCoverageReport({
      products: [
        {
          id: "product-bound",
          sku: "BOUND",
          name: "Bound",
          shopifyProductId: "gid://shopify/Product/1",
          translations: [],
        },
        {
          id: "product-new",
          sku: "NEW",
          name: "New",
          shopifyProductId: "gid://shopify/Product/2",
          translations: [],
        },
        {
          id: "product-conflict",
          sku: "CONFLICT",
          name: "Conflict",
          shopifyProductId: "gid://shopify/Product/3",
          translations: [],
        },
      ],
      collections: [],
      bindings: [
        {
          resourceType: "PRODUCT",
          entityId: "product-bound",
          shopifyResourceId: "gid://shopify/Product/1",
        },
        {
          resourceType: "PRODUCT",
          entityId: "product-conflict",
          shopifyResourceId: "gid://shopify/Product/99",
        },
      ],
    });

    expect(report.rows.map((row) => [row.entityId, row.bindingStatus])).toEqual([
      ["product-bound", "BOUND"],
      ["product-new", "MISSING"],
      ["product-conflict", "CONFLICT"],
    ]);
    expect(planBindingCreates(report)).toEqual([{
      resourceType: "PRODUCT",
      entityId: "product-new",
      shopifyResourceId: "gid://shopify/Product/2",
    }]);
  });

  it("is idempotent after the planned binding is present", () => {
    const input = {
      products: [{
        id: "product-1",
        sku: "ONE",
        name: "One",
        shopifyProductId: "gid://shopify/Product/1",
        translations: [],
      }],
      collections: [],
    };

    const first = buildCoverageReport({ ...input, bindings: [] });
    const creates = planBindingCreates(first);
    const second = buildCoverageReport({ ...input, bindings: creates });

    expect(creates).toHaveLength(1);
    expect(planBindingCreates(second)).toEqual([]);
  });

  it("summarizes translation gaps separately from enforcement blockers", () => {
    const report = buildCoverageReport({
      products: [{
        id: "product-1",
        sku: "ONE",
        name: "One",
        shopifyProductId: null,
        translations: [],
      }],
      collections: [],
      bindings: [],
    });

    expect(summarize(report.rows)).toMatchObject({
      total: 1,
      translationComplete: 0,
      missingPt: 1,
      missingIdentity: 1,
      enforcementReady: 0,
    });
  });
});
