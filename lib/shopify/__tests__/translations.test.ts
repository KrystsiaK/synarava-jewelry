import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  buildTranslationInputs,
  decideProductTranslationPull,
  fetchProductTranslation,
  fetchProductTranslationIndex,
  fetchTranslatableResourceIndex,
  registerProductTranslation,
  registerTranslations,
} from "@/lib/shopify/translations";

beforeEach(() => vi.clearAllMocks());

describe("Shopify translations", () => {
  it("joins local product copy to Shopify digests and skips blank values", () => {
    expect(buildTranslationInputs({
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
    }, "pt-PT")).resolves.toMatchObject({ registeredKeys: ["title"] });

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
    }, "pt-PT");

    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("translationsRemove");
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toEqual({
      resourceId: "gid://shopify/Product/1",
      locales: ["pt-PT"],
      translationKeys: ["handle", "body_html", "meta_title", "meta_description"],
    });
  });

  it("maps Shopify Portuguese translation metadata used for two-way conflict detection", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Anel", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        { key: "body_html", value: "<p>Feito em Lisboa.</p>", updatedAt: "2026-09-10T10:02:00Z", outdated: true },
      ] },
    });

    await expect(fetchProductTranslation("gid://shopify/Product/1", "pt-PT")).resolves.toEqual({
      title: "Anel",
      handle: "",
      descriptionHtml: "<p>Feito em Lisboa.</p>",
      seoTitle: "",
      seoDescription: "",
      updatedAt: "2026-09-10T10:02:00.000Z",
      outdated: true,
    });
  });

  // Proves registerProductTranslation/fetchProductTranslation are genuinely
  // locale-generic — not just "still works for the one locale they used to
  // hardcode" — by exercising a second, unrelated locale (Russian) end to
  // end through both the write and read paths.
  it("registers and reads back a Russian translation the same way as Portuguese", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translationsRemove: { userErrors: [], translations: [] } })
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "title-digest" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Кольцо" }] } });

    await expect(registerProductTranslation("gid://shopify/Product/1", {
      title: "Кольцо",
      descriptionHtml: "",
      seoTitle: "",
      seoDescription: "",
    }, "ru")).resolves.toMatchObject({ registeredKeys: ["title"] });

    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toEqual({
      resourceId: "gid://shopify/Product/1",
      locales: ["ru"],
      translationKeys: ["handle", "body_html", "meta_title", "meta_description"],
    });
    expect(mocks.shopifyAdminRequest.mock.calls[2]?.[1]).toMatchObject({
      translations: [expect.objectContaining({ locale: "ru", key: "title", value: "Кольцо" })],
    });

    mocks.shopifyAdminRequest.mockReset().mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Кольцо", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
      ] },
    });
    await expect(fetchProductTranslation("gid://shopify/Product/1", "ru")).resolves.toMatchObject({ title: "Кольцо" });
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[0]).toContain("updatedAt outdated");
  });

  it("applies a remote edit when the local translation is clean", () => {
    expect(decideProductTranslationPull({
      local: { title: "Anel antigo", descriptionHtml: "", seoTitle: "", seoDescription: "" },
      localSyncStatus: "SYNCED",
      localLastSyncedAt: new Date("2026-09-10T09:00:00Z"),
      remote: {
        title: "Anel novo", descriptionHtml: "", seoTitle: "", seoDescription: "",
        updatedAt: "2026-09-10T10:00:00Z", outdated: false,
      },
    })).toBe("APPLY_REMOTE");
  });

  it("reports a conflict when both Shopify and Synarava changed the translation", () => {
    expect(decideProductTranslationPull({
      local: { title: "Edição local", descriptionHtml: "", seoTitle: "", seoDescription: "" },
      localSyncStatus: "PENDING",
      localLastSyncedAt: new Date("2026-09-10T09:00:00Z"),
      remote: {
        title: "Edição Shopify", descriptionHtml: "", seoTitle: "", seoDescription: "",
        updatedAt: "2026-09-10T10:00:00Z", outdated: false,
      },
    })).toBe("CONFLICT");
  });

  it("keeps a newer local edit when Shopify has not changed since the last sync", () => {
    expect(decideProductTranslationPull({
      local: { title: "Edição local", descriptionHtml: "", seoTitle: "", seoDescription: "" },
      localSyncStatus: "PENDING",
      localLastSyncedAt: new Date("2026-09-10T10:00:00Z"),
      remote: {
        title: "Versão sincronizada", descriptionHtml: "", seoTitle: "", seoDescription: "",
        updatedAt: "2026-09-10T09:59:00Z", outdated: false,
      },
    })).toBe("KEEP_LOCAL");
  });

  it("lets an explicit force pull make Shopify win", () => {
    expect(decideProductTranslationPull({
      local: { title: "Edição local", descriptionHtml: "", seoTitle: "", seoDescription: "" },
      localSyncStatus: "PENDING",
      localLastSyncedAt: new Date("2026-09-10T10:00:00Z"),
      remote: null,
      force: true,
    })).toBe("APPLY_REMOTE");
  });

  it("pushes a first local translation when Shopify has no Portuguese copy yet", () => {
    expect(decideProductTranslationPull({
      local: { title: "Primeira tradução", descriptionHtml: "", seoTitle: "", seoDescription: "" },
      localSyncStatus: "PENDING",
      localLastSyncedAt: null,
      remote: null,
    })).toBe("KEEP_LOCAL");
  });

  it("indexes product translations in pages for reconciliation preview", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: true, endCursor: "next" },
        nodes: [{ resourceId: "gid://shopify/Product/1", translations: [
          { key: "title", value: "Anel", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        ] }],
      } })
      .mockResolvedValueOnce({ translatableResources: {
        pageInfo: { hasNextPage: false, endCursor: null },
        nodes: [{ resourceId: "gid://shopify/Product/2", translations: [] }],
      } });

    const translations = await fetchProductTranslationIndex("pt-PT");
    expect(translations.get("gid://shopify/Product/1")).toMatchObject({ title: "Anel" });
    expect(translations.get("gid://shopify/Product/2")).toBeNull();
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[1]).toEqual({ after: "next", resourceType: "PRODUCT" });
  });

  it("registers translations for a non-Product resource type and locale, generically", async () => {
    // No blank fields in `values`, so translationsRemove is never called (0
    // keys to clear) — only fetchTranslatableContent + translationsRegister.
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "d1" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [{ key: "title", value: "Coleção" }] } });

    await expect(registerTranslations({
      resourceId: "gid://shopify/Collection/1",
      locale: "pt-PT",
      values: { title: "Coleção" },
    })).resolves.toEqual({ registeredKeys: ["title"] });
  });

  it("throws immediately on a non-digest userError instead of retrying", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "title", digest: "d1" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [{ message: "Locale is not enabled on this shop" }] } });

    await expect(registerTranslations({
      resourceId: "gid://shopify/Collection/1",
      locale: "pt-PT",
      values: { title: "Coleção" },
    })).rejects.toThrow("Locale is not enabled on this shop");
    expect(mocks.shopifyAdminRequest).toHaveBeenCalledTimes(2);
  });

  it("paginates a translatable resource index for any resource type", async () => {
    mocks.shopifyAdminRequest.mockResolvedValueOnce({ translatableResources: {
      pageInfo: { hasNextPage: false, endCursor: null },
      nodes: [{ resourceId: "gid://shopify/Collection/1", translations: [] }],
    } });

    const index = await fetchTranslatableResourceIndex("COLLECTION", "pt-PT");
    expect(index.get("gid://shopify/Collection/1")).toEqual([]);
    expect(mocks.shopifyAdminRequest.mock.calls[0]?.[1]).toEqual({ after: null, resourceType: "COLLECTION" });
  });
});
