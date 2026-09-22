import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  listShopCatalogPage: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/security/request-ip", () => ({ getTrustedClientIp: mocks.getTrustedClientIp }));
vi.mock("@/lib/content/shop-listing", () => ({ listShopCatalogPage: mocks.listShopCatalogPage }));

import { GET } from "../route";

function request(query = "") {
  return new Request(`https://synarava.com/api/catalog/products${query}`);
}

describe("GET /api/catalog/products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.listShopCatalogPage.mockResolvedValue({ nodes: [], hasNextPage: false, endCursor: null, totalCount: 0, popularAvailable: true });
  });

  it("rate-limits before touching the catalog loader", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 12 });

    const response = await GET(request());

    expect(response.status).toBe(429);
    expect(mocks.listShopCatalogPage).not.toHaveBeenCalled();
  });

  it("normalizes locale, filters, cursor and page size before calling the shared loader", async () => {
    await GET(request("?locale=pt&department=jewelry&sort=price-asc&cursor=abc&limit=500"));

    expect(mocks.listShopCatalogPage).toHaveBeenCalledWith({
      filters: expect.objectContaining({ department: "jewelry", sort: "price-asc" }),
      locale: "pt",
      cursor: "abc",
      limit: 48, // clamped to CATALOG_MAX_PAGE_SIZE
    });
  });

  it("falls back to English for an unsupported locale", async () => {
    await GET(request("?locale=xx"));

    expect(mocks.listShopCatalogPage).toHaveBeenCalledWith(expect.objectContaining({ locale: "en" }));
  });

  it("returns a safe 500 without leaking the underlying error", async () => {
    mocks.listShopCatalogPage.mockRejectedValue(new Error("db exploded"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("db exploded");
  });

  it("passes the loader's page straight through on success", async () => {
    mocks.listShopCatalogPage.mockResolvedValue({
      nodes: [{ id: "p1" }],
      hasNextPage: true,
      endCursor: "next",
      totalCount: 1,
      popularAvailable: true,
    });

    const response = await GET(request());
    const body = await response.json();

    expect(body.nodes).toEqual([{ id: "p1" }]);
    expect(body.hasNextPage).toBe(true);
  });
});
