import { beforeEach, expect, it, vi } from "vitest";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/shopify/admin", () => ({
  ShopifyAdminError: class extends Error {},
  shopifyAdminRequest: request,
}));
import { pushProductMetafields } from "@/lib/shopify/product-metafields-push";

beforeEach(() => {
  vi.resetAllMocks();
  request.mockImplementation(async (query: string) => query.includes("metafieldsDelete")
    ? { metafieldsDelete: { userErrors: [] } }
    : { metafieldsSet: { userErrors: [] } });
});

it("deletes a cleared custom value and only the managed passport key in its own namespace", async () => {
  await pushProductMetafields({
    ownerId: "p1", hasCustomWindow: true, managedPassportKeys: new Set(["material"]),
    desired: [{ namespace: "custom", key: "material", type: "single_line_text_field", value: "Gold" }],
    remote: [
      { namespace: "custom", key: "wrist_fit" }, { namespace: "custom", key: "material" },
      { namespace: "synarava", key: "material" }, { namespace: "synarava", key: "editorial" },
      { namespace: "shopify", key: "color-pattern" }, { namespace: "global", key: "title_tag" },
    ],
  });
  expect(request).toHaveBeenNthCalledWith(2, expect.stringContaining("metafieldsDelete"), {
    metafields: [
      { ownerId: "p1", namespace: "custom", key: "wrist_fit" },
      { ownerId: "p1", namespace: "synarava", key: "material" },
    ],
  });
});

it("does not delete merchant data before an OUR metafield window exists", async () => {
  await pushProductMetafields({ ownerId: "p1", hasCustomWindow: false, managedPassportKeys: new Set(), desired: [], remote: [{ namespace: "custom", key: "care" }] });
  expect(request).not.toHaveBeenCalled();
});

it("chunks more than 25 values and stops on Shopify validation errors", async () => {
  const desired = Array.from({ length: 26 }, (_, i) => ({ namespace: "custom", key: `field_${i}`, type: "single_line_text_field", value: "x" }));
  await pushProductMetafields({ ownerId: "p1", hasCustomWindow: true, managedPassportKeys: new Set(), desired, remote: [] });
  expect(request.mock.calls.map((call) => call[1].metafields.length)).toEqual([25, 1]);
  request.mockResolvedValueOnce({ metafieldsSet: { userErrors: [{ message: "Invalid value" }] } });
  await expect(pushProductMetafields({ ownerId: "p1", hasCustomWindow: true, managedPassportKeys: new Set(), desired, remote: [] })).rejects.toThrow("Invalid value");
});

it("returns newly-created Shopify IDs for the subsequent locale translation push", async () => {
  const ref = { id: "gid://shopify/Metafield/123", namespace: "custom", key: "care", type: "single_line_text_field" };
  request.mockResolvedValueOnce({ metafieldsSet: { userErrors: [], metafields: [ref, null] } });
  const refs = await pushProductMetafields({ ownerId: "p1", hasCustomWindow: true, managedPassportKeys: new Set(), desired: [{ namespace: ref.namespace, key: ref.key, type: ref.type, value: "Dry" }], remote: [] });
  expect(refs).toEqual([ref]);
  expect(request.mock.calls[0][0]).toContain("metafields { id namespace key type }");
});
