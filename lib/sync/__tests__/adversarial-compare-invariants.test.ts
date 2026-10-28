/**
 * Phase 1 adversarial invariants for compareSyncState / selectSyncCounts.
 * Findings: docs/audits/2026-10-28-sync-adversarial.md
 */
import { describe, expect, it } from "vitest";

import { MULTI_VARIANT_PUSH_BLOCKED_REASON } from "@/lib/shopify/catalog-conflict-policy";
import { canonicalizeShopifyProjection } from "@/lib/shopify/shopify-projection-diff";
import { compareSyncState } from "@/lib/sync/compare";
import { selectSyncCounts, slice } from "@/lib/sync/select";
import type { SyncLeaf } from "@/lib/sync/types";

const LOCALES = [
  { code: "en", shopifyLocale: "en", name: "English", nativeName: "English", isDefault: true, sortOrder: 0 },
  { code: "pt", shopifyLocale: "pt-PT", name: "Portuguese", nativeName: "Português", isDefault: false, sortOrder: 1 },
] as const;

function compare(input: Partial<Parameters<typeof compareSyncState>[0]> = {}) {
  return compareSyncState({
    commerceWindows: [],
    translationDifferences: [],
    productPresence: [],
    collectionPresence: [],
    locales: [...LOCALES],
    connected: true,
    checkedAt: "2026-10-28T12:00:00.000Z",
    runStatus: "SUCCEEDED",
    now: new Date("2026-10-28T12:01:00.000Z"),
    ...input,
  });
}

function leafIds(leaves: readonly SyncLeaf[]): string[] {
  return leaves.map((leaf) => leaf.id).toSorted();
}

function fingerprint(leaves: readonly SyncLeaf[]): string {
  return JSON.stringify(
    leaves
      .map((leaf) => ({
        id: leaf.id,
        fieldKey: leaf.fieldKey,
        contractKey: leaf.contractKey ?? null,
        section: leaf.section ?? null,
        localFingerprint: leaf.localFingerprint ?? null,
        shopifyFingerprint: leaf.shopifyFingerprint ?? null,
        allowedDirections: leaf.allowedDirections,
        parts: leaf.parts ?? null,
      }))
      .toSorted((a, b) => a.id.localeCompare(b.id)),
  );
}

const DIFF_A = { status: "ACTIVE", tags: ["a"], variants: [{ id: "v1", price: "10.00" }] };
const DIFF_B = { status: "DRAFT", tags: ["b"], variants: [{ id: "v1", price: "12.00" }] };

describe("adversarial: compareSyncState determinism + order independence", () => {
  it("same windows yield identical leaf fingerprints regardless of call order", () => {
    const first = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
        { resourceType: "PRODUCT", resourceId: "p2", ourWindow: DIFF_B, shopifySnapshot: DIFF_A },
      ],
    });
    const second = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
        { resourceType: "PRODUCT", resourceId: "p2", ourWindow: DIFF_B, shopifySnapshot: DIFF_A },
      ],
    });
    expect(fingerprint(first.leaves)).toBe(fingerprint(second.leaves));
  });

  it("commerceWindows array order does not change the leaf set", () => {
    const forward = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
        { resourceType: "PRODUCT", resourceId: "p2", ourWindow: DIFF_B, shopifySnapshot: DIFF_A },
      ],
    });
    const reverse = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p2", ourWindow: DIFF_B, shopifySnapshot: DIFF_A },
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
      ],
    });
    expect(leafIds(forward.leaves)).toEqual(leafIds(reverse.leaves));
    expect(fingerprint(forward.leaves)).toBe(fingerprint(reverse.leaves));
  });

  it("media re-host on SAME gid (new url/?v=) yields zero commerce leaves", () => {
    const our = canonicalizeShopifyProjection({
      status: "ACTIVE",
      media: [{
        id: "gid://shopify/MediaImage/1",
        alt: "Front",
        filename: "a.jpg",
        preview: { image: { url: "https://cdn.shopify.com/a.jpg?v=1" } },
      }],
    });
    const shopify = canonicalizeShopifyProjection({
      status: "ACTIVE",
      media: [{
        id: "gid://shopify/MediaImage/1",
        alt: "Front",
        filename: "a.jpg",
        preview: { image: { url: "https://cdn.shopify.com/rehosted/a.jpg?v=9" } },
      }],
    });
    const result = compare({
      commerceWindows: [{ resourceType: "PRODUCT", resourceId: "p1", ourWindow: our, shopifySnapshot: shopify }],
    });
    expect(result.leaves.filter((leaf) => leaf.kind === "commerce")).toHaveLength(0);
  });

  it("media order swap yields exactly one moved leaf (identity compare)", () => {
    const mediaA = [
      { id: "gid://shopify/MediaImage/1", alt: "Front", filename: "a.jpg", preview: { image: { url: "https://cdn/a.jpg" } } },
      { id: "gid://shopify/MediaImage/2", alt: "Side", filename: "b.jpg", preview: { image: { url: "https://cdn/b.jpg" } } },
    ];
    const mediaB = [mediaA[1], mediaA[0]];
    const our = canonicalizeShopifyProjection({ status: "ACTIVE", media: mediaA });
    const shopify = canonicalizeShopifyProjection({ status: "ACTIVE", media: mediaB });
    const result = compare({
      commerceWindows: [{ resourceType: "PRODUCT", resourceId: "p1", ourWindow: our, shopifySnapshot: shopify }],
    });
    const media = result.leaves.filter((leaf) => leaf.kind === "commerce");
    expect(media).toHaveLength(1);
    expect(media[0]!.contractKey).toBe("media.moved");
  });
});

describe("adversarial: counters === leaves", () => {
  it("nav / listChip / editorBanner equal the leaf count for the entity", () => {
    const result = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
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
      ],
    });
    expect(result.leaves).toHaveLength(2);
    expect(selectSyncCounts(result, { kind: "nav" }).products).toBe(2);
    expect(selectSyncCounts(result, { kind: "nav" }).total).toBe(2);
    expect(selectSyncCounts(result, {
      kind: "listChip",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(2);
    expect(selectSyncCounts(result, {
      kind: "editorBanner",
      resourceType: "PRODUCT",
      resourceId: "p1",
    })).toBe(2);
    expect(slice(result, { entityType: "PRODUCT", entityId: "p1" })).toHaveLength(2);
  });
});

describe("adversarial: Take then Keep round-trip via windows", () => {
  it("Take Shopify (align local) then Keep ours (align remote) returns to zero commerce leaves", () => {
    const conflict = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
      ],
    });
    expect(conflict.leaves.filter((l) => l.kind === "commerce")).toHaveLength(1);

    const afterTake = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_B, shopifySnapshot: DIFF_B },
      ],
    });
    expect(afterTake.leaves.filter((l) => l.kind === "commerce")).toHaveLength(0);

    const afterKeep = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_A },
      ],
    });
    expect(afterKeep.leaves.filter((l) => l.kind === "commerce")).toHaveLength(0);
  });
});

describe("adversarial: multi-variant Keep ours blocked at compare", () => {
  it("blocks SYNARAVA_TO_SHOPIFY on multi-variant whole-item", () => {
    const result = compare({
      commerceWindows: [{
        resourceType: "PRODUCT",
        resourceId: "p1",
        ourWindow: {
          status: "ACTIVE",
          variants: [{ id: "v1", price: "10" }, { id: "v2", price: "20" }],
        },
        shopifySnapshot: {
          status: "DRAFT",
          variants: [{ id: "v1", price: "11" }, { id: "v2", price: "21" }],
        },
      }],
    });
    const leaf = result.leaves.find((item) => item.fieldKey === "commerce:whole-item");
    expect(leaf).toBeDefined();
    expect(leaf!.allowedDirections).toEqual(["SHOPIFY_TO_SYNARAVA"]);
    expect(leaf!.blockedReason).toBe(MULTI_VARIANT_PUSH_BLOCKED_REASON);
    expect(leaf!.allowedDirections).not.toContain("SYNARAVA_TO_SHOPIFY");
  });
});

describe("adversarial: every leaf carries contract metadata", () => {
  it("commerce + presence leaves always expose contractKey and section", () => {
    const result = compare({
      commerceWindows: [
        { resourceType: "PRODUCT", resourceId: "p1", ourWindow: DIFF_A, shopifySnapshot: DIFF_B },
        {
          resourceType: "PRODUCT",
          resourceId: "p-adopt",
          ourWindow: null,
          shopifySnapshot: DIFF_B,
        },
      ],
      productPresence: [{
        id: "presence-1",
        kind: "SHOPIFY_ONLY",
        name: "Only Shopify",
        handle: "only-shopify",
        sku: null,
        localProductId: null,
        remoteMissing: false,
        shopifyIdentity: { name: "Only Shopify", handle: "only-shopify", sku: null },
        localIdentity: null,
        localFingerprint: null,
        shopifyFingerprint: "fp",
      }],
    });
    const covered = result.leaves.filter((leaf) => leaf.kind === "commerce" || leaf.kind === "presence");
    expect(covered.length).toBeGreaterThan(0);
    for (const leaf of covered) {
      expect(leaf.contractKey, leaf.id).toBeTruthy();
      expect(leaf.section, leaf.id).toBeTruthy();
    }
  });

  /**
   * SYNC-ADV-001 — translation leaves omit contractKey/section today.
   * Expected to fail until a fix PR adds registry metadata for translations.
   * @see docs/audits/2026-10-28-sync-adversarial.md#SYNC-ADV-001
   */
  it.fails("translation leaves expose contractKey and section (SYNC-ADV-001)", () => {
    const result = compare({
      translationDifferences: [{
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
      }],
    });
    const translation = result.leaves.filter((leaf) => leaf.kind === "translation");
    expect(translation).toHaveLength(1);
    expect(translation[0]!.contractKey).toBeTruthy();
    expect(translation[0]!.section).toBeTruthy();
  });
});
