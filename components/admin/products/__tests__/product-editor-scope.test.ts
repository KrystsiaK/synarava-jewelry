import { describe, expect, it } from "vitest";

import {
  buildScopedProductFormData,
  dirtyKeyForEdit,
  fieldBelongsToBranch,
  localeHasDirty,
  sectionDirtyKey,
} from "@/components/admin/products/product-editor-scope";

describe("product-editor-scope", () => {
  it("marks shared catalog dirty separately from locale essentials", () => {
    expect(dirtyKeyForEdit("pt", "catalog")).toBe("*:catalog");
    expect(dirtyKeyForEdit("pt", "essentials")).toBe("pt:essentials");
  });

  it("detects dirty locale from shared or locale-scoped sections", () => {
    const dirty = new Set([sectionDirtyKey("*", "catalog")]);
    expect(localeHasDirty(dirty, "en", ["essentials", "catalog"])).toBe(true);
    expect(localeHasDirty(new Set([sectionDirtyKey("pt", "content")]), "en", ["content"])).toBe(false);
    expect(localeHasDirty(new Set([sectionDirtyKey("pt", "content")]), "pt", ["content"])).toBe(true);
  });

  it("attributes translation and shared fields to the right branch", () => {
    expect(fieldBelongsToBranch("ptTitle", "essentials", "pt")).toBe(true);
    expect(fieldBelongsToBranch("ptTitle", "essentials", "en")).toBe(false);
    expect(fieldBelongsToBranch("sku", "essentials", "pt")).toBe(true);
    expect(fieldBelongsToBranch("price", "price", "en")).toBe(true);
    expect(fieldBelongsToBranch("compareAt", "price", "en")).toBe(false);
    expect(fieldBelongsToBranch("taxable", "price", "en")).toBe(true);
    expect(fieldBelongsToBranch("cost", "price", "en")).toBe(false);
    expect(fieldBelongsToBranch("price", "essentials", "en")).toBe(false);
    expect(fieldBelongsToBranch("collectionSlug", "catalog", "en")).toBe(true);
    expect(fieldBelongsToBranch("ptShortDescription", "content", "pt")).toBe(true);
    expect(fieldBelongsToBranch("ptShortDescription", "essentials", "pt")).toBe(false);
  });

  it("marks price as a shared dirty section", () => {
    expect(dirtyKeyForEdit("pt", "price")).toBe("*:price");
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
      section: "content",
      locale: "pt",
    });

    expect(scoped.get("name")).toBe("Saved Name");
    expect(scoped.get("shortDescription")).toBe("Saved EN blurb");
    expect(scoped.get("ptShortDescription")).toBe("Dirty PT blurb");
    expect(scoped.get("saveScope")).toBe("pt:content");
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
    expect(scoped.get("sku")).toBe("SKU-2");
    expect(scoped.get("price")).toBe("10");
    expect(scoped.get("workflowState")).toBe("DRAFT");
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
