import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  fetchShopifyUrlRedirects: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/shopify/url-redirects", () => ({
  fetchShopifyUrlRedirects: mocks.fetchShopifyUrlRedirects,
}));

vi.mock("@/lib/db", () => ({
  db: {
    localizedHandleRedirect: {
      count: mocks.count,
      findMany: mocks.findMany,
    },
  },
}));

import { getRedirectsVisibilityReport } from "@/lib/seo/redirects-visibility";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getRedirectsVisibilityReport", () => {
  it("combines Shopify mirror with local LocalizedHandleRedirect samples", async () => {
    mocks.fetchShopifyUrlRedirects.mockResolvedValue({
      status: "ok",
      shopDomain: "synarava.myshopify.com",
      adminRedirectsUrl: "https://admin.shopify.com/store/synarava/content/redirects",
      count: 1,
      countPrecision: "EXACT",
      truncated: false,
      redirects: [{ id: "gid://shopify/UrlRedirect/1", path: "/a", target: "/b" }],
    });
    mocks.count.mockResolvedValue(2);
    mocks.findMany.mockResolvedValue([
      {
        id: "r1",
        entityType: "PRODUCT",
        locale: "pt",
        fromHandle: "old",
        toHandle: "new",
      },
      {
        id: "r2",
        entityType: "WEIRD",
        locale: "en",
        fromHandle: "x",
        toHandle: "y",
      },
    ]);

    const report = await getRedirectsVisibilityReport();

    expect(report.shopify.status).toBe("ok");
    expect(report.local.count).toBe(2);
    expect(report.local.samples).toEqual([
      {
        id: "r1",
        entityType: "PRODUCT",
        locale: "pt",
        fromHandle: "old",
        toHandle: "new",
      },
    ]);
  });
});
