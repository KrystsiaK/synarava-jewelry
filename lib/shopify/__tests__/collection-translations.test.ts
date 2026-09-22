import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  fetchCollectionTranslation,
  fetchCollectionTranslationIndex,
  registerCollectionTranslation,
} from "@/lib/shopify/collection-translations";

beforeEach(() => vi.clearAllMocks());

describe("Shopify collection translations", () => {
  it("registers name/description/SEO against the native COLLECTION keys", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translationsRemove: { userErrors: [] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [
        { key: "title", digest: "title-digest" },
        { key: "body_html", digest: "body-digest" },
      ] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Rituais da Terra" }] } });

    await expect(registerCollectionTranslation("gid://shopify/Collection/1", {
      name: "Rituais da Terra",
      descriptionHtml: "Peças fundamentadas.",
      seoTitle: "",
      seoDescription: "",
    }, "pt-PT")).resolves.toMatchObject({ registeredKeys: ["title"] });

    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toMatchObject({
      resourceId: "gid://shopify/Collection/1",
      locales: ["pt-PT"],
    });
  });

  it("maps remote translation metadata into a flat snapshot", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Rituais da Terra", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        { key: "body_html", value: "<p>Peças.</p>", updatedAt: "2026-09-10T10:02:00Z", outdated: true },
      ] },
    });

    await expect(fetchCollectionTranslation("gid://shopify/Collection/1", "pt-PT")).resolves.toEqual({
      handle: "",
      name: "Rituais da Terra",
      descriptionHtml: "<p>Peças.</p>",
      seoTitle: "",
      seoDescription: "",
      updatedAt: "2026-09-10T10:02:00.000Z",
      outdated: true,
    });
  });

  it("returns null for a resource with no Portuguese translation yet", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({ translatableResource: { translations: [] } });
    await expect(fetchCollectionTranslation("gid://shopify/Collection/1", "pt-PT")).resolves.toBeNull();
  });

  it("indexes collection translations across pages", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: true, endCursor: "next" },
        nodes: [{ resourceId: "gid://shopify/Collection/1", translations: [
          { key: "title", value: "Rituais", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        ] }],
      } })
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ resourceId: "gid://shopify/Collection/2", translations: [] }],
      } });

    const index = await fetchCollectionTranslationIndex("pt-PT");
    expect(index.get("gid://shopify/Collection/1")).toMatchObject({ name: "Rituais" });
    expect(index.get("gid://shopify/Collection/2")).toBeNull();
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[1]).toEqual({ after: "next", resourceType: "COLLECTION" });
  });
});
