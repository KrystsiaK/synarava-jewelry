import { describe, expect, it } from "vitest";

import {
  diffCollectionMembership,
  isSynaravaProductAccessible,
  pickShopifyProductImageUrl,
  refreshShopifyProductAfterPush,
  synaravaVisibilityForShopifyProduct,
} from "@/lib/shopify/reconciliation";

describe("Shopify storefront projection", () => {
  it("keeps unlisted products accessible by direct URL but out of public listings", () => {
    expect(isSynaravaProductAccessible("ACTIVE", "PUBLIC")).toBe(true);
    expect(isSynaravaProductAccessible("UNLISTED", "UNLISTED")).toBe(true);
    expect(isSynaravaProductAccessible("UNLISTED", "PRIVATE")).toBe(false);
    expect(isSynaravaProductAccessible("DRAFT", "PRIVATE")).toBe(false);
  });

  it("requires both ACTIVE status and an Online Store publication", () => {
    expect(synaravaVisibilityForShopifyProduct("ACTIVE", true)).toBe("PUBLIC");
    expect(synaravaVisibilityForShopifyProduct("ACTIVE", false)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("DRAFT", true)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("ARCHIVED", true)).toBe("PRIVATE");
    expect(synaravaVisibilityForShopifyProduct("UNLISTED", true)).toBe("UNLISTED");
    expect(synaravaVisibilityForShopifyProduct("UNLISTED", false)).toBe("PRIVATE");
  });

  it("refreshes the product after all Shopify mutations before persisting the snapshot", async () => {
    const initial = { id: "gid://shopify/Product/1", updatedAt: "before" };
    const refreshed = { id: initial.id, updatedAt: "after" };

    await expect(refreshShopifyProductAfterPush(initial, async () => refreshed)).resolves.toBe(refreshed);
    await expect(refreshShopifyProductAfterPush(initial, async () => null)).resolves.toBe(initial);
  });

  it("retries refresh until isSettled reports inventory catch-up", async () => {
    const stale = { id: "p1", qty: 1 };
    const live = { id: "p1", qty: 4 };
    let calls = 0;
    const result = await refreshShopifyProductAfterPush(
      stale,
      async () => {
        calls += 1;
        return calls < 3 ? stale : live;
      },
      {
        attempts: 5,
        delayMs: 1,
        isSettled: (fresh) => fresh.qty === 4,
      },
    );
    expect(result).toEqual(live);
    expect(calls).toBe(3);
  });

  it("uses the first Shopify image media when no featured image is set", () => {
    expect(
      pickShopifyProductImageUrl({
        featuredImageUrl: null,
        media: [
          { mediaContentType: "VIDEO", imageUrl: "https://cdn.shopify.com/video-preview.jpg" },
          { mediaContentType: "IMAGE", imageUrl: "https://cdn.shopify.com/product.jpg" },
        ],
      }),
    ).toBe("https://cdn.shopify.com/product.jpg");
  });
});

describe("diffCollectionMembership", () => {
  it("reports nothing to change when membership already matches", () => {
    expect(diffCollectionMembership(["gid://shopify/Collection/1"], ["gid://shopify/Collection/1"]))
      .toEqual({ toJoin: [], toLeave: [] });
  });

  it("joins collections that are desired but not yet linked", () => {
    expect(diffCollectionMembership(["gid://shopify/Collection/1"], [])).toEqual({
      toJoin: ["gid://shopify/Collection/1"],
      toLeave: [],
    });
  });

  it("leaves collections that are linked but no longer desired", () => {
    expect(diffCollectionMembership([], ["gid://shopify/Collection/1"])).toEqual({
      toJoin: [],
      toLeave: ["gid://shopify/Collection/1"],
    });
  });

  it("computes join and leave sets independently for a partial overlap", () => {
    expect(
      diffCollectionMembership(
        ["gid://shopify/Collection/1", "gid://shopify/Collection/2"],
        ["gid://shopify/Collection/2", "gid://shopify/Collection/3"],
      ),
    ).toEqual({
      toJoin: ["gid://shopify/Collection/1"],
      toLeave: ["gid://shopify/Collection/3"],
    });
  });
});
