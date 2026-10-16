import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  fetchCatalog: vi.fn(),
}));

vi.mock("@/lib/sku/ops-auth", () => ({ authorizeSkuOpsRequest: mocks.authorize }));
vi.mock("@/lib/shopify/sku-catalog", () => ({ fetchShopifySkuCatalog: mocks.fetchCatalog }));

import { GET } from "../route";

describe("GET /api/ops/sku-catalog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorize.mockReturnValue({ ok: true });
    mocks.fetchCatalog.mockResolvedValue({
      ok: true,
      source: "shopify",
      complete: true,
      itemCount: 1,
      items: [{ externalVariantId: "gid://shopify/ProductVariant/1", sku: "EY-ACC-001" }],
    });
  });

  it("returns a no-store complete Shopify snapshot to an authorized caller", async () => {
    const request = new Request("https://shop.synarava.com/api/ops/sku-catalog");
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ source: "shopify", complete: true, itemCount: 1 });
  });

  it("rejects an invalid bearer before Shopify is called", async () => {
    mocks.authorize.mockReturnValue({ ok: false, status: 401 });
    const response = await GET(new Request("https://shop.synarava.com/api/ops/sku-catalog"));

    expect(response.status).toBe(401);
    expect(mocks.fetchCatalog).not.toHaveBeenCalled();
  });

  it("returns 502 instead of a partial catalog when Shopify fails", async () => {
    mocks.fetchCatalog.mockRejectedValue(new Error("Shopify unavailable"));
    const response = await GET(new Request("https://shop.synarava.com/api/ops/sku-catalog"));

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: expect.stringMatching(/complete Shopify/i) });
  });
});
