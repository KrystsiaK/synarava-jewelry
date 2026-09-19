import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import { upsertShopifyPage } from "@/lib/shopify/page-resource";

beforeEach(() => vi.clearAllMocks());

describe("Shopify page resource", () => {
  it("creates the native page when no Shopify identity exists", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      pageCreate: { page: { id: "gid://shopify/Page/1", handle: "manifesto" }, userErrors: [] },
    });

    await expect(upsertShopifyPage({
      title: "Manifesto", body: "<p>Body</p>", handle: "manifesto", isPublished: true,
    })).resolves.toMatchObject({ id: "gid://shopify/Page/1" });
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("pageCreate");
  });

  it("updates the native page when its identity is already bound", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      pageUpdate: { page: { id: "gid://shopify/Page/1", handle: "manifesto" }, userErrors: [] },
    });

    await upsertShopifyPage({
      resourceId: "gid://shopify/Page/1",
      title: "Manifesto", body: "", handle: "manifesto", isPublished: false,
    });
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("pageUpdate");
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toMatchObject({ id: "gid://shopify/Page/1" });
  });
});
