import { describe, expect, it } from "vitest";

import { compareSyncState } from "@/lib/sync/compare";
import {
  SYNC_BASE_NODE,
  conflictAddress,
  leafTreeNode,
  selectSyncCounts,
  slice,
  treeNodeForLocale,
} from "@/lib/sync/select";
import type { SyncLeaf, SyncResult } from "@/lib/sync/types";
import { emptySyncResult } from "@/lib/sync/types";

function leaf(partial: Partial<SyncLeaf> & Pick<SyncLeaf, "id" | "fieldKey" | "locale">): SyncLeaf {
  return {
    resourceType: "PRODUCT",
    resourceId: "p1",
    kind: "commerce",
    label: partial.fieldKey,
    synaravaValue: "a",
    shopifyValue: "b",
    allowedDirections: ["SHOPIFY_TO_SYNARAVA", "SYNARAVA_TO_SHOPIFY"],
    blockedReason: null,
    sourceId: null,
    path: partial.fieldKey,
    ...partial,
  };
}

function imageOnlyFixture(): SyncResult {
  return emptySyncResult({
    state: "ready",
    checkedAt: "2026-10-26T12:00:00.000Z",
    leaves: [
      leaf({
        id: "media-0",
        kind: "commerce",
        locale: null,
        fieldKey: "media[0]",
        label: "Image 1 exists only in Synarava, not in Shopify",
        synaravaValue: "ring.jpg",
        shopifyValue: "—",
        path: "media[0]",
      }),
    ],
  });
}

function ptOnlyFixture(): SyncResult {
  return emptySyncResult({
    state: "ready",
    checkedAt: "2026-10-26T12:00:00.000Z",
    leaves: [
      leaf({
        id: "pt-title",
        kind: "translation",
        locale: "pt",
        fieldKey: "title",
        label: "Title",
        synaravaValue: "Anel",
        shopifyValue: "Ring",
      }),
    ],
  });
}

function mixedFixture(): SyncResult {
  return compareSyncState({
    commerceWindows: [
      {
        resourceType: "PRODUCT",
        resourceId: "p1",
        workingSnapshot: { title: "Local", handle: "ring", vendor: "Us" },
        shopifySnapshot: { title: "Remote", handle: "ring", vendor: "Them" },
      },
      {
        resourceType: "COLLECTION",
        resourceId: "c1",
        workingSnapshot: { title: "Local C", handle: "c" },
        shopifySnapshot: { title: "Remote C", handle: "c" },
      },
    ],
    translationDifferences: [
      {
        id: "div-pt",
        rootEntityType: "PRODUCT",
        rootEntityId: "p1",
        locale: "pt-PT",
        fieldKey: "title",
        fieldLabel: "Title",
        kind: "CONFLICT",
        localValue: "Anel",
        shopifyValue: "Ring",
        localFingerprint: "a",
        shopifyFingerprint: "b",
        targetKind: "NATIVE",
      },
      {
        id: "div-pt-c",
        rootEntityType: "COLLECTION",
        rootEntityId: "c1",
        locale: "pt-PT",
        fieldKey: "name",
        fieldLabel: "Name",
        kind: "CONFLICT",
        localValue: "Coleção",
        shopifyValue: "Collection",
        localFingerprint: "a",
        shopifyFingerprint: "b",
        targetKind: "NATIVE",
      },
    ],
    productPresence: [],
    collectionPresence: [],
    locales: [
      { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
      { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
      { code: "ru", shopifyLocale: "ru", name: "Russian", nativeName: "Русский", isDefault: false, sortOrder: 2 },
    ],
    connected: true,
    checkedAt: "2026-10-26T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-26T12:01:00.000Z"),
  });
}

describe("sync tree slice", () => {
  it("maps null locale and en to base address", () => {
    expect(treeNodeForLocale("en")).toBe(SYNC_BASE_NODE);
    expect(treeNodeForLocale("EN")).toBe(SYNC_BASE_NODE);
    expect(leafTreeNode(leaf({ id: "1", fieldKey: "price", locale: null }))).toBe(SYNC_BASE_NODE);
    expect(conflictAddress(leaf({ id: "1", fieldKey: "price", locale: null }))).toEqual({
      entityType: "PRODUCT",
      entityId: "p1",
      node: SYNC_BASE_NODE,
      fieldKey: "price",
    });
    expect(conflictAddress(leaf({ id: "2", fieldKey: "title", locale: "pt" })).node).toBe("pt");
  });

  it("image-only conflict: entity total + base only; absent from PT/RU", () => {
    const result = imageOnlyFixture();
    const entity = slice(result, { entityId: "p1" });
    const base = slice(result, { entityId: "p1", node: "base" });
    const pt = slice(result, { entityId: "p1", node: "pt" });
    const ru = slice(result, { entityId: "p1", node: "ru" });

    expect(entity).toHaveLength(1);
    expect(base).toHaveLength(1);
    expect(pt).toHaveLength(0);
    expect(ru).toHaveLength(0);
    expect(selectSyncCounts(result, {
      kind: "localeTab",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "en",
    })).toBe(1);
    expect(selectSyncCounts(result, {
      kind: "localeTab",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "pt",
    })).toBe(0);
  });

  it("PT-only conflict: PT tab + entity total; base and RU empty", () => {
    const result = ptOnlyFixture();
    expect(slice(result, { entityId: "p1" })).toHaveLength(1);
    expect(slice(result, { entityId: "p1", node: "base" })).toHaveLength(0);
    expect(slice(result, { entityId: "p1", node: "pt" })).toHaveLength(1);
    expect(slice(result, { entityId: "p1", node: "ru" })).toHaveLength(0);
  });

  it("invariant: count(entity) == count(base) + sum(count(locale))", () => {
    const result = mixedFixture();
    for (const entityId of ["p1", "c1"]) {
      const entityType = entityId === "p1" ? "PRODUCT" as const : "COLLECTION" as const;
      const entityLeaves = slice(result, { entityType, entityId });
      const base = slice(result, { entityType, entityId, node: "base" });
      const locales = ["pt", "ru"];
      const localeSum = locales.reduce(
        (sum, code) => sum + slice(result, { entityType, entityId, node: code }).length,
        0,
      );
      expect(entityLeaves.length).toBe(base.length + localeSum);
    }
  });

  it("product and collection behave identically under slice", () => {
    const result = mixedFixture();
    const productBase = slice(result, { entityType: "PRODUCT", entityId: "p1", node: "base" }).length;
    const productPt = slice(result, { entityType: "PRODUCT", entityId: "p1", node: "pt" }).length;
    const collectionBase = slice(result, { entityType: "COLLECTION", entityId: "c1", node: "base" }).length;
    const collectionPt = slice(result, { entityType: "COLLECTION", entityId: "c1", node: "pt" }).length;

    // Both have commerce (base) + one PT translation in this fixture.
    expect(productBase).toBeGreaterThan(0);
    expect(collectionBase).toBeGreaterThan(0);
    expect(productPt).toBe(1);
    expect(collectionPt).toBe(1);
    expect(slice(result, { entityType: "PRODUCT", entityId: "p1", node: "ru" })).toHaveLength(0);
    expect(slice(result, { entityType: "COLLECTION", entityId: "c1", node: "ru" })).toHaveLength(0);
  });

  it("shared conflicts never light locale tabs via selectSyncCounts", () => {
    const result = imageOnlyFixture();
    expect(selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(1);
    expect(selectSyncCounts(result, {
      kind: "localeTab",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "pt",
    })).toBe(0);
    expect(selectSyncCounts(result, {
      kind: "sectionChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
      locale: "ru",
    })).toBe(0);
  });
});
