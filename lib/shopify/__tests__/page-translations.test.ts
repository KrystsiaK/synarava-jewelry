import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  fetchPageTranslation,
  registerPageTranslation,
} from "@/lib/shopify/page-translations";

beforeEach(() => vi.clearAllMocks());

describe("Shopify page translations", () => {
  it("registers flat copy against Shopify PAGE translation keys", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translationsRemove: { userErrors: [] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [
        { key: "title", digest: "title-digest" },
        { key: "body_html", digest: "body-digest" },
      ] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [] } });

    await registerPageTranslation("gid://shopify/Page/1", {
      title: "Manifesto",
      bodyHtml: "<p>Feito para ser usado.</p>",
      seoTitle: "",
      seoDescription: "",
    });

    expect(mocks.shopifyAdminRequest.mock.calls[2]?.[1]).toMatchObject({
      resourceId: "gid://shopify/Page/1",
      translations: [
        expect.objectContaining({ key: "title", value: "Manifesto" }),
        expect.objectContaining({ key: "body_html", value: "<p>Feito para ser usado.</p>" }),
      ],
    });
  });

  it("maps Shopify PAGE translation metadata into a snapshot", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Manifesto", updatedAt: "2026-09-19T10:00:00Z", outdated: false },
        { key: "body_html", value: "<p>Texto.</p>", updatedAt: "2026-09-19T10:01:00Z", outdated: true },
      ] },
    });

    await expect(fetchPageTranslation("gid://shopify/Page/1")).resolves.toEqual({
      handle: "",
      title: "Manifesto",
      bodyHtml: "<p>Texto.</p>",
      seoTitle: "",
      seoDescription: "",
      updatedAt: "2026-09-19T10:01:00.000Z",
      outdated: true,
    });
  });
});
