import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  buildProductTranslationInputs,
  fetchProductTranslation,
  registerProductTranslation,
} from "@/lib/shopify/translations";

beforeEach(() => vi.clearAllMocks());

describe("Shopify translations", () => {
  it("joins local product copy to Shopify digests and skips blank values", () => {
    expect(buildProductTranslationInputs({
      locale: "pt-PT",
      values: { title: "Anel Lava", body_html: "", meta_title: "Anel de prata" },
      translatableContent: [
        { key: "title", digest: "title-digest" },
        { key: "body_html", digest: "body-digest" },
        { key: "meta_title", digest: "seo-digest" },
      ],
    })).toEqual([
      { locale: "pt-PT", key: "title", value: "Anel Lava", translatableContentDigest: "title-digest" },
      { locale: "pt-PT", key: "meta_title", value: "Anel de prata", translatableContentDigest: "seo-digest" },
    ]);
  });

  it("refreshes stale digests once before registering again", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translationsRemove: { userErrors: [], translations: [] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "old" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [{ message: "Translatable content digest is invalid" }] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "new" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Anel" }] } });

    await expect(registerProductTranslation("gid://shopify/Product/1", {
      title: "Anel",
      descriptionHtml: "",
      seoTitle: "",
      seoDescription: "",
    })).resolves.toMatchObject({ registeredKeys: ["title"] });

    expect(mocks.shopifyAdminRequest).toHaveBeenCalledTimes(5);
    expect(mocks.shopifyAdminRequest.mock.calls[4]?.[1]).toMatchObject({
      translations: [expect.objectContaining({ translatableContentDigest: "new" })],
    });
  });

  it("removes previously registered Shopify values when optional copy is cleared", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translationsRemove: { userErrors: [], translations: [] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "title-digest" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Anel" }] } });

    await registerProductTranslation("gid://shopify/Product/1", {
      title: "Anel",
      descriptionHtml: "",
      seoTitle: "",
      seoDescription: "",
    });

    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("translationsRemove");
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toEqual({
      resourceId: "gid://shopify/Product/1",
      locales: ["pt-PT"],
      translationKeys: ["body_html", "meta_title", "meta_description"],
    });
  });

  it("maps an existing Shopify Portuguese translation for a safe first import", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Anel" },
        { key: "body_html", value: "<p>Feito em Lisboa.</p>" },
      ] },
    });

    await expect(fetchProductTranslation("gid://shopify/Product/1")).resolves.toEqual({
      title: "Anel",
      descriptionHtml: "<p>Feito em Lisboa.</p>",
      seoTitle: "",
      seoDescription: "",
    });
  });
});
