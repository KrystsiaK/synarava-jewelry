import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ shopifyAdminRequest: vi.fn() }));
vi.mock("@/lib/shopify/admin", () => ({
  shopifyAdminRequest: mocks.shopifyAdminRequest,
  ShopifyAdminError: class ShopifyAdminError extends Error {},
}));

import {
  ensureEditorialMetaobject,
  metaobjectFieldKey,
  registerEditorialMetaobjectTranslation,
  serializeEditorialFields,
} from "@/lib/shopify/editorial-metaobjects";

beforeEach(() => vi.clearAllMocks());

describe("editorial metaobjects", () => {
  it("serializes structured values deterministically and normalizes dotted field keys", () => {
    expect(metaobjectFieldKey("nav.shop")).toBe("nav_shop");
    expect(serializeEditorialFields({
      eyebrow: "Archive",
      legalSections: [{ id: "privacy", title: "Privacy" }],
      blank: "",
    })).toEqual({
      eyebrow: "Archive",
      legal_sections: '[{"id":"privacy","title":"Privacy"}]',
    });
  });

  it("creates a translatable app-owned definition and upserts the English source", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ metaobjectDefinitionByType: null })
      .mockResolvedValueOnce({ metaobjectDefinitionCreate: {
        metaobjectDefinition: { id: "gid://shopify/MetaobjectDefinition/1" }, userErrors: [],
      } })
      .mockResolvedValueOnce({ metaobjectUpsert: {
        metaobject: { id: "gid://shopify/Metaobject/1", handle: "home" }, userErrors: [],
      } });

    await expect(ensureEditorialMetaobject({
      definition: "page_section_copy",
      name: "Page section copy",
      handle: "home",
      values: { eyebrow: "Archive", materialLexicon: [{ name: "Pearls" }] },
    })).resolves.toEqual({ id: "gid://shopify/Metaobject/1", handle: "home" });

    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[1]).toMatchObject({
      definition: {
        type: "$app:page_section_copy",
        capabilities: { translatable: { enabled: true } },
      },
    });
    expect(mocks.shopifyAdminRequest.mock.calls[2]?.[1]).toMatchObject({
      handle: { type: "$app:page_section_copy", handle: "home" },
      metaobject: { fields: expect.arrayContaining([
        { key: "eyebrow", value: "Archive" },
        { key: "material_lexicon", value: '[{"name":"Pearls"}]' },
      ]) },
    });
  });

  it("registers Portuguese values on the metaobject resource", async () => {
    mocks.shopifyAdminRequest
      .mockResolvedValueOnce({ translatableResource: { translatableContent: [{ key: "eyebrow", digest: "d1" }] } })
      .mockResolvedValueOnce({ translationsRegister: { userErrors: [], translations: [] } });

    await registerEditorialMetaobjectTranslation("gid://shopify/Metaobject/1", {
      eyebrow: "Arquivo",
    });

    expect(mocks.shopifyAdminRequest.mock.calls[1]?.[1]).toMatchObject({
      resourceId: "gid://shopify/Metaobject/1",
      translations: [expect.objectContaining({ key: "eyebrow", value: "Arquivo" })],
    });
  });
});
