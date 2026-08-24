import { beforeEach, describe, expect, it, vi } from "vitest";

const mockedEnv = vi.hoisted(() => ({
  SHOPIFY_STORE_DOMAIN: "synarava.myshopify.com" as string | undefined,
  SHOPIFY_CLIENT_ID: "client-id" as string | undefined,
  SHOPIFY_CLIENT_SECRET: "client-secret" as string | undefined,
  SHOPIFY_ADMIN_ACCESS_TOKEN: undefined as string | undefined,
  SHOPIFY_ADMIN_API_VERSION: "2026-07" as string | undefined,
}));

vi.mock("@/lib/env", () => ({ env: mockedEnv }));

describe("Shopify Admin authentication", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    mockedEnv.SHOPIFY_STORE_DOMAIN = "synarava.myshopify.com";
    mockedEnv.SHOPIFY_CLIENT_ID = "client-id";
    mockedEnv.SHOPIFY_CLIENT_SECRET = "client-secret";
    mockedEnv.SHOPIFY_ADMIN_ACCESS_TOKEN = undefined;
    mockedEnv.SHOPIFY_ADMIN_API_VERSION = "2026-07";
  });

  it("exchanges client credentials once and reuses the cached token", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "admin-token", expires_in: 86_399 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockImplementation(async () =>
        new Response(JSON.stringify({ data: { shop: { name: "Synarava" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const { shopifyAdminRequest } = await import("@/lib/shopify/admin");
    await shopifyAdminRequest("query Shop { shop { name } }");
    await shopifyAdminRequest("query Shop { shop { name } }");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://synarava.myshopify.com/admin/oauth/access_token",
    );
    const tokenRequest = fetchMock.mock.calls[0]?.[1];
    expect(tokenRequest?.headers).toEqual({
      "Content-Type": "application/x-www-form-urlencoded",
    });
    expect(String(tokenRequest?.body)).toContain("grant_type=client_credentials");
    expect(String(tokenRequest?.body)).toContain("client_id=client-id");
    expect(String(tokenRequest?.body)).toContain("client_secret=client-secret");
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      "X-Shopify-Access-Token": "admin-token",
    });
    expect(fetchMock.mock.calls[2]?.[1]?.headers).toMatchObject({
      "X-Shopify-Access-Token": "admin-token",
    });
  });

  it("refreshes the token and retries once after an unauthorized response", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "expired-token", expires_in: 86_399 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 401, statusText: "Unauthorized" }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 86_399 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { shop: { name: "Synarava" } } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const { shopifyAdminRequest } = await import("@/lib/shopify/admin");
    const result = await shopifyAdminRequest<{ shop: { name: string } }>(
      "query Shop { shop { name } }",
    );

    expect(result.shop.name).toBe("Synarava");
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls[3]?.[1]?.headers).toMatchObject({
      "X-Shopify-Access-Token": "fresh-token",
    });
  });

  it("uses a static access token when client credentials are absent", async () => {
    mockedEnv.SHOPIFY_CLIENT_ID = undefined;
    mockedEnv.SHOPIFY_CLIENT_SECRET = undefined;
    mockedEnv.SHOPIFY_ADMIN_ACCESS_TOKEN = "static-token";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { shop: { name: "Synarava" } } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const { shopifyAdminRequest } = await import("@/lib/shopify/admin");
    await shopifyAdminRequest("query Shop { shop { name } }");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-Shopify-Access-Token": "static-token",
    });
  });
});
