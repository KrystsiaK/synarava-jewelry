import { describe, expect, it } from "vitest";

import {
  describeConflictConfirmChange,
  formatConfirmDirectionSummary,
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
    baseValue: null,
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
  });

  it("resolveConflictEntitySummary falls back to Untitled when title missing", () => {
    expect(resolveConflictEntitySummary({
      id: "shopify:1",
      entityNoun: "product",
      entity: { id: "shopify:1", name: "shopify:1" },
    }).name).toBe("Untitled product");
  });

  it("describes create / update / remove headlines and before-after", () => {
    const create = describeConflictConfirmChange(
      {
        field: presenceField("SYNARAVA_ONLY", "Pets"),
        direction: "SYNARAVA_TO_SHOPIFY",
      },
      { id: "c1", name: "Pets" },
      "collection",
    );
    expect(create.headline).toBe('Create "Pets" in Shopify');
    expect(create.consequence).toBe("create");
    expect(create.beforeValue).toBe("Not in Shopify");
    expect(create.afterValue).toContain("Pets");
    expect(create.sourceSide).toBe("synarava");
    expect(create.targetSide).toBe("shopify");

    const update = describeConflictConfirmChange(
      {
        field: baseField(),
        direction: "SYNARAVA_TO_SHOPIFY",
      },
      { id: "p1", name: "Lava Ring" },
      "product",
    );
    expect(update.headline).toBe("Update price in Shopify");
    expect(update.consequence).toBe("update");
    expect(update.beforeValue).toBe("110.00 EUR");
    expect(update.afterValue).toBe("120.00 EUR");

    const takeShopify = describeConflictConfirmChange(
      {
        field: baseField({
          fieldKey: "translation:pt:title",
          label: "Title",
          origin: "TRANSLATION",
          synaravaValue: "Anel",
          shopifyValue: "Anel Shopify",
        }),
        direction: "SHOPIFY_TO_SYNARAVA",
      },
      { id: "p1", name: "Lava Ring" },
      "product",
    );
    expect(takeShopify.headline).toBe("Take Shopify's title into Synarava");
    expect(takeShopify.sourceSide).toBe("shopify");
    expect(takeShopify.targetSide).toBe("synarava");
    expect(takeShopify.beforeValue).toBe("Anel");
    expect(takeShopify.afterValue).toBe("Anel Shopify");

    const remove = describeConflictConfirmChange(
      {
        field: presenceField("SYNARAVA_ONLY", "Pets"),
        direction: "SHOPIFY_TO_SYNARAVA",
      },
      { id: "c1", name: "Pets" },
      "collection",
    );
    expect(remove.headline).toBe('Remove "Pets" from Synarava (linked products stay)');
    expect(remove.consequence).toBe("remove");
    expect(remove.afterValue).toBe("Removed");
  });

  it("uses Untitled when presence title is missing", () => {
    const field = presenceField("SHOPIFY_ONLY", "Home page");
    field.presenceDifference = {
      ...field.presenceDifference!,
      name: "",
      shopifyIdentity: { name: "", handle: "frontpage", sku: "" },
    };
    field.shopifyValue = " · /frontpage";
    const view = describeConflictConfirmChange(
      { field, direction: "SHOPIFY_TO_SYNARAVA" },
      { id: "shopify-collection:1", name: "shopify-collection:1" },
      "collection",
    );
    expect(view.headline).toBe('Create "Untitled collection" in Synarava');
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
