import { describe, expect, it } from "vitest";

import {
  catalogConflictFieldsForEntity,
  catalogConflictFieldsFromLeaves,
} from "@/lib/sync/conflict-fields-from-leaves";
import { emptySyncResult, type SyncLeaf } from "@/lib/sync/types";
import type { CatalogPresenceDifference } from "@/lib/shopify/catalog-presence";

const locales = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
];

function leaf(overrides: Partial<SyncLeaf> & Pick<SyncLeaf, "kind" | "fieldKey" | "label">): SyncLeaf {
  return {
    id: "id",
    resourceType: "PRODUCT",
    resourceId: "p1",
    locale: null,
    synaravaValue: "local",
    shopifyValue: "remote",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: null,
    presenceSide: null,
    targetKind: "NATIVE",
    localFingerprint: "fp-local",
    shopifyFingerprint: "fp-shopify",
    ...overrides,
  };
}

describe("catalogConflictFieldsFromLeaves", () => {
  it("maps commerce leaf to SHARED COMMERCE field", () => {
    const fields = catalogConflictFieldsFromLeaves([
      leaf({
        kind: "commerce",
        fieldKey: "commerce:name",
        label: "Name",
        path: "title",
      }),
    ], locales);

    expect(fields).toHaveLength(1);
    expect(fields[0]).toMatchObject({
      fieldKey: "commerce:name",
      origin: "COMMERCE",
      scope: { kind: "SHARED" },
      targetKind: "NATIVE",
      localFingerprint: "fp-local",
      shopifyFingerprint: "fp-shopify",
      path: "title",
    });
  });

  it("maps translation leaf locale to LOCALE scope via locale meta", () => {
    const fields = catalogConflictFieldsFromLeaves([
      leaf({
        kind: "translation",
        fieldKey: "translation:pt-PT:title",
        label: "Title",
        locale: "pt",
        sourceId: "div-1",
        targetKind: "METAFIELD",
      }),
    ], locales);

    expect(fields[0]).toMatchObject({
      origin: "TRANSLATION",
      scope: { kind: "LOCALE", code: "pt", name: "Portuguese", nativeName: "Português" },
      targetKind: "METAFIELD",
      sourceId: "div-1",
    });
  });

  it("attaches presenceDifference and uses presenceSide values, not label matching", () => {
    const presence: CatalogPresenceDifference = {
      id: "shopify:42",
      kind: "SHOPIFY_ONLY",
      localProductId: null,
      shopifyProductId: "gid://shopify/Product/42",
      name: "Remote",
      handle: "remote",
      sku: "R-42",
      localFingerprint: "missing",
      shopifyFingerprint: "remote-fp",
      remoteMissing: false,
      matchReason: null,
      localIdentity: null,
      shopifyIdentity: { name: "Remote", handle: "remote", sku: "R-42" },
    };

    const fields = catalogConflictFieldsFromLeaves([
      leaf({
        kind: "presence",
        fieldKey: "presence:product",
        label: "Product exists only in Shopify",
        resourceId: "shopify:42",
        presenceSide: "SHOPIFY_ONLY",
        allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
        synaravaValue: "— Product is missing —",
        shopifyValue: "Remote",
        localFingerprint: "missing",
        shopifyFingerprint: "remote-fp",
      }),
    ], locales, presence);

    expect(fields[0]).toMatchObject({
      origin: "PRESENCE",
      synaravaValue: "— Product is missing —",
      shopifyValue: "Remote · SKU R-42",
      presenceDifference: presence,
      allowedDirections: ["SHOPIFY_TO_SYNARAVA"],
    });
  });
});

describe("catalogConflictFieldsForEntity", () => {
  it("filters SyncResult leaves to one resource", () => {
    const result = emptySyncResult({
      state: "ready",
      checkedAt: "2026-10-25T00:00:00.000Z",
      leaves: [
        leaf({ kind: "commerce", fieldKey: "commerce:name", label: "Name", resourceId: "p1" }),
        leaf({ kind: "commerce", fieldKey: "commerce:name", label: "Name", resourceId: "p2", id: "other" }),
      ],
    });

    const fields = catalogConflictFieldsForEntity(result, {
      resourceType: "PRODUCT",
      resourceId: "p1",
      locales,
    });

    expect(fields).toHaveLength(1);
    expect(fields[0]?.fieldKey).toBe("commerce:name");
  });
});
