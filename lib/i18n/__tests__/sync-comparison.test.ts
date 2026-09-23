import { describe, expect, it } from "vitest";

import {
  COLLECTION_FIELD_REGISTRY,
  PAGE_FIELD_REGISTRY,
  PRODUCT_FIELD_REGISTRY,
  STOREFRONT_COPY_FIELD_REGISTRY,
  type EntityFieldRegistry,
} from "@/lib/i18n/admin-field-registry";
import {
  compareLocalizedFields,
  fingerprintSyncValue,
  normalizeSyncValue,
  shopifyValueForLocal,
} from "@/lib/i18n/sync-comparison";

const REGISTRY: EntityFieldRegistry = {
  entity: "widget",
  fields: [
    { key: "title", label: "Title", mode: "localized", required: "always", kind: "short-text", shopifyTarget: { kind: "native", resource: "WIDGET", key: "title" } },
    { key: "body", label: "Body", mode: "localized", required: "optional", kind: "long-text", shopifyTarget: { kind: "native", resource: "WIDGET", key: "body_html" } },
    { key: "details", label: "Details", mode: "localized", required: "optional", kind: "rich-text", shopifyTarget: { kind: "metaobject", definition: "widget_copy", key: "details" } },
    { key: "sku", label: "SKU", mode: "shared", required: "always", kind: "short-text", shopifyTarget: null },
  ],
};

describe("normalizeSyncValue", () => {
  it("treats Shopify HTML and the equivalent local plain text as equal", () => {
    const body = REGISTRY.fields[1];

    expect(normalizeSyncValue(body, "Made by hand\n in Lisbon."))
      .toBe(normalizeSyncValue(body, "<p>Made by hand&nbsp; in <strong>Lisbon.</strong></p>"));
  });

  it("treats null, undefined, and whitespace-only values as the same empty value", () => {
    const title = REGISTRY.fields[0];

    expect(normalizeSyncValue(title, null)).toBe(normalizeSyncValue(title, undefined));
    expect(normalizeSyncValue(title, "   ")).toBe(normalizeSyncValue(title, null));
  });

  it("compares structured copy independently of object key order", () => {
    const details = REGISTRY.fields[2];
    const local = { groups: [{ title: "Materials", body: "Silver" }], version: 1 };
    const shopify = { version: 1, groups: [{ body: "Silver", title: "Materials" }] };

    expect(normalizeSyncValue(details, local)).toBe(normalizeSyncValue(details, shopify));
    expect(fingerprintSyncValue(details, local)).toBe(fingerprintSyncValue(details, shopify));
  });

  it("converts Shopify HTML and serialized rich text into editor-safe local values", () => {
    expect(shopifyValueForLocal(REGISTRY.fields[1], "<p>Made &amp; finished <strong>by hand</strong>.</p>"))
      .toBe("Made & finished by hand.");
    expect(shopifyValueForLocal(REGISTRY.fields[2], "{\"material\":\"silver\"}"))
      .toEqual({ material: "silver" });
  });
});

describe("compareLocalizedFields", () => {
  const base = { title: "Ring", body: "Old body", details: { material: "Silver" }, sku: "SKU-1" };

  it("returns only real localized differences and never shared commerce fields", () => {
    const differences = compareLocalizedFields(
      REGISTRY,
      base,
      { ...base, title: "New ring", sku: "SKU-2" },
      { ...base, sku: "SKU-3" },
    );

    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      fieldKey: "title",
      fieldLabel: "Title",
      targetKind: "native",
      kind: "local-only",
      baseValue: "Ring",
      localValue: "New ring",
      shopifyValue: "Ring",
    });
  });

  it("classifies Shopify-only edits and carries remote freshness metadata", () => {
    const differences = compareLocalizedFields(REGISTRY, base, base, { ...base, body: "Edited in Shopify" }, {
      body: { updatedAt: "2026-09-20T09:00:00.000Z", outdated: false },
    });

    expect(differences).toHaveLength(1);
    expect(differences[0]).toMatchObject({
      fieldKey: "body",
      kind: "shopify-only",
      shopifyUpdatedAt: "2026-09-20T09:00:00.000Z",
      shopifyOutdated: false,
    });
  });

  it("marks incompatible two-sided edits as a conflict", () => {
    const differences = compareLocalizedFields(
      REGISTRY,
      base,
      { ...base, title: "Synarava title" },
      { ...base, title: "Shopify title" },
    );

    expect(differences).toHaveLength(1);
    expect(differences[0].kind).toBe("conflict");
  });

  it("uses a safe first-sync classification when no common base exists", () => {
    expect(compareLocalizedFields(REGISTRY, null, { title: "Local" }, { title: "" })[0].kind).toBe("local-only");
    expect(compareLocalizedFields(REGISTRY, null, { title: "" }, { title: "Remote" })[0].kind).toBe("shopify-only");
    expect(compareLocalizedFields(REGISTRY, null, { title: "Local" }, { title: "Remote" })[0].kind).toBe("conflict");
  });

  it.each([
    ["Product", PRODUCT_FIELD_REGISTRY, "title"],
    ["Collection", COLLECTION_FIELD_REGISTRY, "name"],
    ["Page", PAGE_FIELD_REGISTRY, "title"],
    ["Header & Footer", STOREFRONT_COPY_FIELD_REGISTRY, "nav.home"],
  ])("supports the %s registry without emitting equal fields", (_name, registry, fieldKey) => {
    const value = { [fieldKey]: "Same value" };
    expect(compareLocalizedFields(registry, value, value, value)).toEqual([]);
  });
});
