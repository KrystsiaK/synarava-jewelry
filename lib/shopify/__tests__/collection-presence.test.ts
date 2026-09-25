import { describe, expect, it } from "vitest";

import { classifyCollectionPresence } from "@/lib/shopify/collection-presence";

const local = (overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  shopifyCollectionId: string | null;
  updatedAt: string;
}> = {}) => ({
  id: "local-1",
  name: "DIY kits",
  slug: "diy-creative-kits",
  shopifyCollectionId: "gid://shopify/Collection/1",
  updatedAt: "2026-09-23T10:00:00.000Z",
  ...overrides,
});

const remote = (overrides: Partial<{
  id: string;
  title: string;
  handle: string;
  updatedAt: string;
}> = {}) => ({
  id: "gid://shopify/Collection/1",
  title: "DIY kits",
  handle: "diy-creative-kits",
  updatedAt: "2026-09-23T10:00:00.000Z",
  ...overrides,
});

describe("classifyCollectionPresence", () => {
  it("returns no difference for a linked collection present on both sides", () => {
    expect(classifyCollectionPresence([local()], [remote()])).toEqual([]);
  });

  it("surfaces a Shopify-only collection with a stable virtual conflict id", () => {
    const result = classifyCollectionPresence([], [remote({ id: "gid://shopify/Collection/42" })]);

    expect(result).toEqual([
      expect.objectContaining({
        id: "shopify-collection:42",
        kind: "SHOPIFY_ONLY",
        localProductId: null,
        shopifyProductId: "gid://shopify/Collection/42",
        handle: "diy-creative-kits",
        matchReason: null,
      }),
    ]);
  });

  it("matches an unlinked local collection by unique handle", () => {
    const result = classifyCollectionPresence(
      [local({ shopifyCollectionId: null })],
      [remote({ id: "gid://shopify/Collection/99" })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "local-1",
        kind: "SHOPIFY_ONLY",
        localProductId: "local-1",
        shopifyProductId: "gid://shopify/Collection/99",
        matchReason: "HANDLE",
      }),
    ]);
  });

  it("surfaces Synarava-only collections and marks remoteMissing when a dead Shopify id remains", () => {
    const unlinked = classifyCollectionPresence([local({ shopifyCollectionId: null })], []);
    const orphaned = classifyCollectionPresence([local()], []);

    expect(unlinked[0]).toMatchObject({
      id: "local-1",
      kind: "SYNARAVA_ONLY",
      remoteMissing: false,
    });
    expect(orphaned[0]).toMatchObject({
      id: "local-1",
      kind: "SYNARAVA_ONLY",
      remoteMissing: true,
      shopifyProductId: "gid://shopify/Collection/1",
    });
  });
});
