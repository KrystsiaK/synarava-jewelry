import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  buildProductTranslationInputs,
  decideProductTranslationPull,
  fetchProductTranslation,
  fetchProductTranslationIndex,
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

  it("maps Shopify Portuguese translation metadata used for two-way conflict detection", async () => {
    mocks.shopifyAdminRequest.mockResolvedValue({
      translatableResource: { translations: [
        { key: "title", value: "Anel", updatedAt: "2026-09-10T10:00:00Z", outdated: false },
        { key: "body_html", value: "<p>Feito em Lisboa.</p>", updatedAt: "2026-09-10T10:02:00Z", outdated: true },
      ] },
    });

    await expect(fetchProductTranslation("gid://shopify/Product/1")).resolves.toEqual({
      title: "Anel",
      descriptionHtml: "<p>Feito em Lisboa.</p>",
      seoTitle: "",
      seoDescription: "",
      updatedAt: "2026-09-10T10:02:00.000Z",
      outdated: true,
    });
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

    const translations = await fetchProductTranslationIndex();
    expect(translations.get("gid://shopify/Product/1")).toMatchObject({ title: "Anel" });
    expect(translations.get("gid://shopify/Product/2")).toBeNull();
    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[1]).toEqual({ after: "next" });
  });
});
