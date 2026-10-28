import { describe, expect, it } from "vitest";

import {
  buildScopedProductFormData,
  fieldBelongsToBranch,
  localesDirtyFromFields,
  sectionsDirtyFromFields,
  syncBaselineNamedFields,
} from "@/components/admin/products/product-editor-scope";

describe("product-editor-scope", () => {
  it("differs named form fields by value (typing and reverting)", () => {
    const baseline = new FormData();
    baseline.set("name", "Ring");
    baseline.set("sku", "SKU-1");
    const edited = new FormData();
    edited.set("name", "Ring Updated");
    edited.set("sku", "SKU-1");
    expect(syncBaselineNamedFields(baseline, edited)).toEqual(["name"]);
    const reverted = new FormData();
    reverted.set("name", "Ring");
    reverted.set("sku", "SKU-1");
    expect(syncBaselineNamedFields(baseline, reverted)).toEqual([]);
  });

  it("absorbs newly appeared named fields without marking dirty", () => {
    const baseline = new FormData();
    baseline.set("name", "Ring");
    const current = new FormData();
    current.set("name", "Ring");
    current.set("sku", "PENDING-1");
    expect(syncBaselineNamedFields(baseline, current)).toEqual([]);
    expect(baseline.get("sku")).toBe("PENDING-1");
  });

  it("derives dirty locales/sections from changed field names", () => {
    expect([...sectionsDirtyFromFields(["name"], "en", ["essentials", "price", "inventory"])]).toEqual([
      "essentials",
    ]);
    expect([...sectionsDirtyFromFields(["price"], "pt", ["essentials", "price"])]).toEqual(["price"]);
    expect([...localesDirtyFromFields(["price"], ["en", "pt"], ["essentials", "price"])].toSorted()).toEqual([
      "en",
      "pt",
    ]);
    expect([...localesDirtyFromFields(["ptTitle"], ["en", "pt"], ["essentials", "price"])]).toEqual(["pt"]);
  });

  it("attributes translation and shared fields to the right branch", () => {
    expect(fieldBelongsToBranch("ptTitle", "essentials", "pt")).toBe(true);
    expect(fieldBelongsToBranch("ptTitle", "essentials", "en")).toBe(false);
    expect(fieldBelongsToBranch("sku", "inventory", "pt")).toBe(true);
    expect(fieldBelongsToBranch("sku", "essentials", "pt")).toBe(false);
    expect(fieldBelongsToBranch("sku", "shopify", "pt")).toBe(false);
    expect(fieldBelongsToBranch("seriesLabel", "details", "en")).toBe(true);
    expect(fieldBelongsToBranch("tags", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("price", "price", "en")).toBe(true);
    expect(fieldBelongsToBranch("compareAt", "price", "en")).toBe(false);
    expect(fieldBelongsToBranch("taxable", "price", "en")).toBe(true);
    expect(fieldBelongsToBranch("cost", "price", "en")).toBe(false);
    expect(fieldBelongsToBranch("price", "essentials", "en")).toBe(false);
    expect(fieldBelongsToBranch("collectionSlug", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("workflowState", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("shopifyCategoryId", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("description", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("seoTitle", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("ptShortDescription", "details", "pt")).toBe(true);
    expect(fieldBelongsToBranch("ptShortDescription", "essentials", "pt")).toBe(false);
    expect(fieldBelongsToBranch("symbolismBody", "details", "en")).toBe(true);
  });

  it("attributes custom metafield form fields to the Metafields section by locale", () => {
    expect(fieldBelongsToBranch("customMetafieldValue:custom:warranty", "metafields", "en")).toBe(true);
    expect(fieldBelongsToBranch("customMetafieldType:custom:warranty", "metafields", "en")).toBe(true);
    expect(fieldBelongsToBranch("customMetafieldValue:custom:warranty", "metafields", "pt")).toBe(false);
    expect(fieldBelongsToBranch("ptCustomMetafieldValue:custom:warranty", "metafields", "pt")).toBe(true);
    expect(fieldBelongsToBranch("ptCustomMetafieldValue:custom:warranty", "metafields", "en")).toBe(false);
    expect(fieldBelongsToBranch("customMetafieldType:custom:warranty", "metafields", "pt")).toBe(false);
    expect(fieldBelongsToBranch("customMetafieldValue:custom:warranty", "essentials", "en")).toBe(false);
  });

  it("attributes Shopify product specs (custom.material, …) to Product, not Metafields", () => {
    expect(fieldBelongsToBranch("customMetafieldValue:custom:material", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("customMetafieldType:custom:finish", "essentials", "en")).toBe(true);
    expect(fieldBelongsToBranch("ptCustomMetafieldValue:custom:wrist_fit", "essentials", "pt")).toBe(true);
    expect(fieldBelongsToBranch("customMetafieldValue:custom:material", "metafields", "en")).toBe(false);
    expect(fieldBelongsToBranch("ptCustomMetafieldValue:custom:care_instructions", "metafields", "pt")).toBe(false);
  });

  it("attributes passport characteristic fields to Passport, not Product", () => {
    expect(fieldBelongsToBranch("characteristic_chain_length", "passport", "en")).toBe(true);
    expect(fieldBelongsToBranch("characteristic_reach_certified", "passport", "en")).toBe(true);
    expect(fieldBelongsToBranch("characteristic_chain_length", "essentials", "en")).toBe(false);
    expect(fieldBelongsToBranch("collectionSlug", "passport", "en")).toBe(false);
  });

  it("writes organization fields from the current branch when saving Product", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");
    baseline.set("collectionSlug", "old-collection");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Dirty Name");
    current.set("slug", "dirty-name");
    current.set("sku", "SKU-1");
    current.set("price", "10");
    current.set("stockOnHand", "1");
    current.set("workflowState", "PUBLISHED");
    current.set("collectionSlug", "new-collection");

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "essentials",
      locale: "en",
    });

    expect(scoped.get("name")).toBe("Dirty Name");
    expect(scoped.get("workflowState")).toBe("PUBLISHED");
    expect(scoped.get("collectionSlug")).toBe("new-collection");
  });

  it("builds a scoped FormData that keeps baseline values for other branches", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");
    baseline.set("shortDescription", "Saved EN blurb");
    baseline.set("ptShortDescription", "Saved PT blurb");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Dirty Name");
    current.set("slug", "saved-name");
    current.set("sku", "SKU-1");
    current.set("price", "10");
    current.set("stockOnHand", "1");
    current.set("workflowState", "DRAFT");
    current.set("shortDescription", "Dirty EN blurb");
    current.set("ptShortDescription", "Dirty PT blurb");

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "details",
      locale: "pt",
    });

    expect(scoped.get("name")).toBe("Saved Name");
    expect(scoped.get("shortDescription")).toBe("Saved EN blurb");
    expect(scoped.get("ptShortDescription")).toBe("Dirty PT blurb");
    expect(scoped.get("saveScope")).toBe("pt:details");
  });

  it("writes essentials required fields from the current branch when saving essentials", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Dirty Name");
    current.set("slug", "dirty-name");
    current.set("sku", "SKU-2");
    current.set("price", "20");
    current.set("stockOnHand", "3");
    current.set("workflowState", "PUBLISHED");

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "essentials",
      locale: "en",
    });

    expect(scoped.get("name")).toBe("Dirty Name");
    expect(scoped.get("sku")).toBe("SKU-1");
    expect(scoped.get("price")).toBe("10");
    expect(scoped.get("workflowState")).toBe("PUBLISHED");
  });

  it("writes SKU from the current branch when saving Inventory", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Saved Name");
    current.set("slug", "saved-name");
    current.set("sku", "SKU-2");
    current.set("price", "10");
    current.set("stockOnHand", "3");
    current.set("workflowState", "DRAFT");

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "inventory",
      locale: "en",
    });

    expect(scoped.get("sku")).toBe("SKU-2");
    expect(scoped.get("stockOnHand")).toBe("3");
    expect(scoped.get("name")).toBe("Saved Name");
  });

  it("does not treat legacy media-alt FormData keys as Media branch fields", () => {
    // Gallery alts persist via frame ops — not product Save FormData.
    expect(fieldBelongsToBranch("media-alt-abc123", "media", "en")).toBe(false);
    expect(fieldBelongsToBranch("media-alt-tree-0", "media", "pt")).toBe(false);
  });

  it("Media scoped save keeps shared product fields without media-alt FormData", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Saved Name");
    current.set("slug", "saved-name");
    current.set("sku", "SKU-1");
    current.set("price", "10");
    current.set("stockOnHand", "1");
    current.set("workflowState", "DRAFT");

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "media",
      locale: "en",
    });

    expect(scoped.get("name")).toBe("Saved Name");
    expect(scoped.get("saveScope")).toBe("en:media");
    expect(scoped.get("media-alt-m1")).toBeNull();
  });

  it("writes price-tab fields from the current branch when saving price", () => {
    const baseline = new FormData();
    baseline.set("productId", "p1");
    baseline.set("name", "Saved Name");
    baseline.set("slug", "saved-name");
    baseline.set("sku", "SKU-1");
    baseline.set("price", "10");
    baseline.set("cost", "");
    baseline.set("taxable", "1");
    baseline.set("stockOnHand", "1");
    baseline.set("workflowState", "DRAFT");

    const current = new FormData();
    current.set("productId", "p1");
    current.set("name", "Saved Name");
    current.set("slug", "saved-name");
    current.set("sku", "SKU-1");
    current.set("price", "25.50");
    current.set("cost", "8");
    current.set("stockOnHand", "1");
    current.set("workflowState", "DRAFT");
    // taxable unchecked → absent from FormData

    const scoped = buildScopedProductFormData({
      baseline,
      current,
      section: "price",
      locale: "en",
    });

    expect(scoped.get("price")).toBe("25.50");
    expect(scoped.get("cost")).toBeNull();
    expect(scoped.get("taxable")).toBe("0");
    expect(scoped.get("name")).toBe("Saved Name");
  });
});
