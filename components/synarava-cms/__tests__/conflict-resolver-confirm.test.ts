import { describe, expect, it } from "vitest";

import {
  conflictFieldDisplayLabel,
  describeConflictConfirmChange,
  formatConflictEntityHeader,
  formatConfirmDirectionSummary,
  groupConfirmEntriesByEntityId,
  isTechnicalEntityId,
  resolveConflictEntitySummary,
  summarizeConfirmDirections,
} from "@/components/synarava-cms/conflict-resolver-confirm";
import type { CatalogConflictField } from "@/lib/shopify/catalog-conflict";

function baseField(overrides: Partial<CatalogConflictField> = {}): CatalogConflictField {
  return {
    fieldKey: "commerce:price",
    label: "Price",
    scope: { kind: "SHARED" },
    origin: "COMMERCE",
    targetKind: "NATIVE",
    synaravaValue: "120.00 EUR",
    shopifyValue: "110.00 EUR",
    localFingerprint: "local",
    shopifyFingerprint: "shopify",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    ...overrides,
  };
}

function presenceField(kind: "SHOPIFY_ONLY" | "SYNARAVA_ONLY", name: string): CatalogConflictField {
  const shopifyOnly = kind === "SHOPIFY_ONLY";
  return baseField({
    fieldKey: "presence:collection",
    label: shopifyOnly ? "Collection exists only in Shopify" : "Collection exists only in Synarava",
    origin: "PRESENCE",
    synaravaValue: shopifyOnly ? "— Collection is missing —" : `${name} · /${name.toLowerCase()}`,
    shopifyValue: shopifyOnly ? `${name} · /${name.toLowerCase()}` : "— Collection is missing —",
    presenceDifference: {
      id: shopifyOnly ? "shopify-collection:1" : "c1",
      kind,
      localProductId: shopifyOnly ? null : "c1",
      shopifyProductId: shopifyOnly ? "gid://shopify/Collection/1" : null,
      name,
      handle: name.toLowerCase(),
      sku: "",
      localFingerprint: "l",
      shopifyFingerprint: "s",
      remoteMissing: !shopifyOnly,
      matchReason: null,
      localIdentity: shopifyOnly ? null : { name, handle: name.toLowerCase(), sku: "" },
      shopifyIdentity: shopifyOnly ? { name, handle: name.toLowerCase(), sku: "" } : null,
    },
  });
}

describe("conflict-resolver-confirm", () => {
  it("never treats technical ids as titles", () => {
    expect(isTechnicalEntityId("shopify-collection:705203536203")).toBe(true);
    expect(isTechnicalEntityId("shopify:42")).toBe(true);
    expect(isTechnicalEntityId("Home page")).toBe(false);
  });

  it("formatConflictEntityHeader shows type · title · handle/SKU, never a technical id", () => {
    expect(formatConflictEntityHeader(
      { name: "Pets", detail: "/pets" },
      "collection",
    )).toBe("Collection · Pets /pets");
    expect(formatConflictEntityHeader(
      { name: "Lava Ring", detail: "SKU LAVA-1" },
      "product",
    )).toBe("Product · Lava Ring SKU LAVA-1");
  });

  it("resolveConflictEntitySummary prefers presence title over synthetic id", () => {
    const field = presenceField("SHOPIFY_ONLY", "Home page");
    field.presenceDifference = {
      ...field.presenceDifference!,
      id: "shopify-collection:705203536203",
      handle: "frontpage",
      shopifyIdentity: { name: "Home page", handle: "frontpage", sku: "" },
    };
    const summary = resolveConflictEntitySummary({
      id: "shopify-collection:705203536203",
      entityNoun: "collection",
      entity: { id: "shopify-collection:705203536203", name: "shopify-collection:705203536203" },
      fields: [field],
    });
    expect(summary.name).toBe("Home page");
    expect(summary.detail).toBe("/frontpage");
    expect(formatConflictEntityHeader(summary, "collection")).toBe(
      "Collection · Home page /frontpage",
    );
  });

  it("resolveConflictEntitySummary falls back to Untitled when title missing", () => {
    expect(resolveConflictEntitySummary({
      id: "shopify:1",
      entityNoun: "product",
      entity: { id: "shopify:1", name: "shopify:1" },
    }).name).toBe("Untitled product");
  });

  it("describes collection Name merge with field + direction arrow", () => {
    const field = baseField({
      fieldKey: "commerce:name",
      label: "Name",
      synaravaValue: "Pets",
      shopifyValue: "Pets Shopify",
    });
    expect(conflictFieldDisplayLabel(field)).toBe("Name");
    const view = describeConflictConfirmChange(
      { field, direction: "SHOPIFY_TO_SYNARAVA" },
      { id: "c1", name: "Pets", detail: "/pets" },
      "collection",
    );
    expect(view.headline).toBe("Name: Shopify → Synarava");
    expect(view.beforeValue).toBe("Pets");
    expect(view.afterValue).toBe("Pets Shopify");
  });

  it("describes product Price merge Synarava → Shopify", () => {
    const view = describeConflictConfirmChange(
      { field: baseField(), direction: "SYNARAVA_TO_SHOPIFY" },
      { id: "p1", name: "Lava Ring", detail: "SKU LAVA-1" },
      "product",
    );
    expect(view.headline).toBe("Price: Synarava → Shopify");
    expect(view.beforeValue).toBe("110.00 EUR");
    expect(view.afterValue).toBe("120.00 EUR");
  });

  it("describes page EN title as a translation leaf with direction arrow", () => {
    const view = describeConflictConfirmChange(
      {
        field: baseField({
          fieldKey: "translation:en:title",
          label: "Title",
          origin: "TRANSLATION",
          scope: { kind: "LOCALE", code: "en", name: "English", nativeName: "English" },
          synaravaValue: "About",
          shopifyValue: "About us",
        }),
        direction: "SHOPIFY_TO_SYNARAVA",
      },
      { id: "page-1", name: "About" },
      "page",
    );
    expect(view.headline).toBe("Title: Shopify → Synarava");
    expect(view.beforeValue).toBe("About");
    expect(view.afterValue).toBe("About us");
  });

  it("describes create / remove item headlines with direction arrows", () => {
    const create = describeConflictConfirmChange(
      {
        field: presenceField("SYNARAVA_ONLY", "Pets"),
        direction: "SYNARAVA_TO_SHOPIFY",
      },
      { id: "c1", name: "Pets", detail: "/pets" },
      "collection",
    );
    expect(create.headline).toBe("Create item: Synarava → Shopify");
    expect(create.consequence).toBe("create");
    expect(create.beforeValue).toBe("Not in Shopify");
    expect(create.afterValue).toContain("Pets");

    const remove = describeConflictConfirmChange(
      {
        field: presenceField("SYNARAVA_ONLY", "Pets"),
        direction: "SHOPIFY_TO_SYNARAVA",
      },
      { id: "c1", name: "Pets", detail: "/pets" },
      "collection",
    );
    expect(remove.headline).toBe("Remove item: Shopify → Synarava");
    expect(remove.consequence).toBe("remove");
    expect(remove.afterValue).toBe("Removed");
  });

  it("uses Untitled when presence title is missing for the entity header summary", () => {
    const field = presenceField("SHOPIFY_ONLY", "Home page");
    field.presenceDifference = {
      ...field.presenceDifference!,
      name: "",
      shopifyIdentity: { name: "", handle: "frontpage", sku: "" },
    };
    const summary = resolveConflictEntitySummary({
      id: "shopify-collection:1",
      entityNoun: "collection",
      entity: { id: "shopify-collection:1", name: "shopify-collection:1" },
      fields: [field],
    });
    expect(summary.name).toBe("Untitled collection");
    expect(formatConflictEntityHeader(summary, "collection")).toBe(
      "Collection · Untitled collection /frontpage",
    );
  });

  it("groups confirm entries by item in first-seen order", () => {
    const groups = groupConfirmEntriesByEntityId([
      { entityId: "c1", fieldKey: "a" },
      { entityId: "c2", fieldKey: "b" },
      { entityId: "c1", fieldKey: "c" },
    ]);
    expect(groups.map((group) => group.entityId)).toEqual(["c1", "c2"]);
    expect(groups[0]?.entries).toHaveLength(2);
    expect(groups[1]?.entries).toHaveLength(1);
  });

  it("summarizes mixed directions", () => {
    const counts = summarizeConfirmDirections([
      { direction: "SYNARAVA_TO_SHOPIFY" },
      { direction: "SYNARAVA_TO_SHOPIFY" },
      { direction: "SHOPIFY_TO_SYNARAVA" },
    ]);
    expect(counts).toEqual({ toShopify: 2, toSynarava: 1 });
    expect(formatConfirmDirectionSummary(counts)).toBe(
      "2 changes to Shopify · 1 change to Synarava",
    );
  });
});
