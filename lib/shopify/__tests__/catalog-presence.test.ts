import { describe, expect, it } from "vitest";

import { classifyCatalogPresence } from "@/lib/shopify/catalog-presence";

const local = (overrides: Partial<{
  id: string;
  name: string;
  slug: string;
  sku: string;
  shopifyProductId: string | null;
  updatedAt: string;
}> = {}) => ({
  id: "local-1",
  name: "Amber ring",
  slug: "amber-ring",
  sku: "AR-1",
  shopifyProductId: "gid://shopify/Product/1",
  updatedAt: "2026-09-23T10:00:00.000Z",
  ...overrides,
});

const remote = (overrides: Partial<{
  id: string;
  title: string;
  handle: string;
  sku: string;
  updatedAt: string;
}> = {}) => ({
  id: "gid://shopify/Product/1",
  title: "Amber ring",
  handle: "amber-ring",
  sku: "AR-1",
  updatedAt: "2026-09-23T10:00:00.000Z",
  ...overrides,
});

describe("classifyCatalogPresence", () => {
  it("returns no difference for a linked product present on both sides", () => {
    expect(classifyCatalogPresence([local()], [remote()])).toEqual([]);
  });

  it("surfaces a Shopify-only product with a stable virtual conflict id", () => {
    const result = classifyCatalogPresence([], [remote({ id: "gid://shopify/Product/42" })]);

    expect(result).toEqual([
      expect.objectContaining({
        id: "shopify:42",
        kind: "SHOPIFY_ONLY",
        localProductId: null,
        shopifyProductId: "gid://shopify/Product/42",
        name: "Amber ring",
        sku: "AR-1",
      }),
    ]);
  });

  it("surfaces an unlinked local product as Synarava-only", () => {
    const result = classifyCatalogPresence([local({ shopifyProductId: null })], []);

    expect(result).toEqual([
      expect.objectContaining({
        id: "local-1",
        kind: "SYNARAVA_ONLY",
        localProductId: "local-1",
        shopifyProductId: null,
        remoteMissing: false,
      }),
    ]);
  });

  it("treats a unique SKU match as an unlinked Shopify side and only imports into that local row", () => {
    const result = classifyCatalogPresence(
      [local({ shopifyProductId: null })],
      [remote({ id: "gid://shopify/Product/99" })],
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "local-1",
        kind: "SHOPIFY_ONLY",
        localProductId: "local-1",
        shopifyProductId: "gid://shopify/Product/99",
        matchReason: "SKU",
      }),
    ]);
  });

  it("does not guess an ambiguous SKU match", () => {
    const result = classifyCatalogPresence(
      [
        local({ id: "local-1", slug: "ring-one", shopifyProductId: null }),
        local({ id: "local-2", slug: "ring-two", shopifyProductId: null }),
      ],
      [remote({ id: "gid://shopify/Product/99" })],
    );

    expect(result.map((item) => [item.id, item.kind])).toEqual([
      ["local-1", "SYNARAVA_ONLY"],
      ["local-2", "SYNARAVA_ONLY"],
      ["shopify:99", "SHOPIFY_ONLY"],
    ]);
  });

  it("surfaces a formerly linked product deleted in Shopify as a recreatable Synarava-only product", () => {
    const result = classifyCatalogPresence([local()], []);

    expect(result[0]).toMatchObject({
      id: "local-1",
      kind: "SYNARAVA_ONLY",
      shopifyProductId: "gid://shopify/Product/1",
      remoteMissing: true,
    });
  });

  it("changes the relevant fingerprint when either side changes", () => {
    const firstLocal = classifyCatalogPresence([local({ shopifyProductId: null })], [])[0];
    const changedLocal = classifyCatalogPresence([local({ shopifyProductId: null, name: "Changed" })], [])[0];
    const firstRemote = classifyCatalogPresence([], [remote()])[0];
    const changedRemote = classifyCatalogPresence([], [remote({ title: "Changed" })])[0];

    expect(firstLocal.localFingerprint).not.toBe(changedLocal.localFingerprint);
    expect(firstRemote.shopifyFingerprint).not.toBe(changedRemote.shopifyFingerprint);
  });
});
