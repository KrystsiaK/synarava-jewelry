import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));

vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class ShopifyAdminError extends Error {},
  shopifyAdminRequest: mocks.request,
}));

import {
  sourceContentAsRemoteValues,
  updateShopifySourceField,
} from "@/lib/shopify/source-content";

const titleField = {
  key: "title",
  label: "Title",
  mode: "localized" as const,
  required: "always" as const,
  kind: "short-text" as const,
  shopifyTarget: { kind: "native" as const, resource: "PRODUCT", key: "title" },
};

beforeEach(() => vi.clearAllMocks());

describe("Shopify source content", () => {
  it("projects English source values and rejects a different store primary locale", () => {
    expect(sourceContentAsRemoteValues([
      { key: "title", digest: "digest", value: "Pearl ring", locale: "en" },
    ])).toEqual([{ key: "title", value: "Pearl ring", updatedAt: null, outdated: null }]);

    expect(() => sourceContentAsRemoteValues([
      { key: "title", digest: "digest", value: "Anel", locale: "pt-PT" },
    ])).toThrow(/primary language/i);
  });

  it("refuses to clear a required Shopify source field", async () => {
    await expect(updateShopifySourceField({
      resourceType: "PRODUCT",
      resourceId: "gid://shopify/Product/1",
      field: titleField,
      value: "",
    })).rejects.toThrow(/required/i);
    expect(mocks.request).not.toHaveBeenCalled();
  });

  it("patches one Product source field without commerce data", async () => {
    mocks.request.mockResolvedValue({ productUpdate: { product: { id: "gid://shopify/Product/1" }, userErrors: [] } });

    await updateShopifySourceField({
      resourceType: "PRODUCT",
      resourceId: "gid://shopify/Product/1",
      field: titleField,
      value: "Pearl ring",
    });

    expect(mocks.request).toHaveBeenCalledWith(expect.stringContaining("productUpdate"), {
      product: { id: "gid://shopify/Product/1", title: "Pearl ring" },
    });
  });

  it("patches exactly one app-owned metaobject field", async () => {
    mocks.request.mockResolvedValue({ metaobjectUpdate: { metaobject: { id: "gid://shopify/Metaobject/1" }, userErrors: [] } });

    await updateShopifySourceField({
      resourceType: "METAOBJECT",
      resourceId: "gid://shopify/Metaobject/1",
      field: {
        ...titleField,
        key: "materialLine",
        label: "Material line",
        required: "optional",
        shopifyTarget: { kind: "metaobject", definition: "product_detail_copy", key: "material_line" },
      },
      value: "Freshwater pearl",
    });

    expect(mocks.request).toHaveBeenCalledWith(expect.stringContaining("metaobjectUpdate"), {
      id: "gid://shopify/Metaobject/1",
      metaobject: { fields: [{ key: "material_line", value: "Freshwater pearl" }] },
    });
  });
});
