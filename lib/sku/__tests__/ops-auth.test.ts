import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getConfig: vi.fn() }));
vi.mock("@/lib/sku/config", () => ({ getSkuServiceConfig: mocks.getConfig }));

import { authorizeSkuOpsRequest } from "@/lib/sku/ops-auth";

describe("authorizeSkuOpsRequest", () => {
  beforeEach(() => {
    mocks.getConfig.mockReturnValue({
      configured: true,
      baseUrl: "https://sku.example.test",
      serviceToken: "shared-token-123",
      workspaceKey: "synarava-shop",
    });
  });

  it("accepts the configured SKU bearer token", () => {
    const request = new Request("https://shop.example.test/api/ops/sku-catalog", {
      headers: { Authorization: "Bearer shared-token-123" },
    });
    expect(authorizeSkuOpsRequest(request)).toEqual({ ok: true });
  });

  it("rejects missing or incorrect credentials", () => {
    expect(authorizeSkuOpsRequest(new Request("https://shop.example.test"))).toEqual({
      ok: false,
      status: 401,
    });
    const wrong = new Request("https://shop.example.test", {
      headers: { Authorization: "Bearer wrong-token" },
    });
    expect(authorizeSkuOpsRequest(wrong)).toEqual({ ok: false, status: 401 });
  });

  it("reports unavailable when the shared service token is not configured", () => {
    mocks.getConfig.mockReturnValue({ configured: false, reason: "not configured" });
    expect(authorizeSkuOpsRequest(new Request("https://shop.example.test"))).toEqual({
      ok: false,
      status: 503,
    });
  });
});
