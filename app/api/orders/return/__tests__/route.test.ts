import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getTrustedClientIp: vi.fn(),
  requestShopifyOrderReturn: vi.fn(),
  getServerTranslations: vi.fn(),
}));

vi.mock("@/lib/auth/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit }));
vi.mock("@/lib/security/request-ip", () => ({ getTrustedClientIp: mocks.getTrustedClientIp }));
vi.mock("@/lib/shopify/customer-account/api", () => ({ requestShopifyOrderReturn: mocks.requestShopifyOrderReturn }));
vi.mock("@/lib/i18n/server", () => ({ getServerTranslations: mocks.getServerTranslations }));

import { POST } from "../route";

function request(body: unknown) {
  return new Request("https://synarava.com/api/orders/return", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("orders return API route (REV-23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.checkRateLimit.mockResolvedValue({ ok: true });
    mocks.getServerTranslations.mockResolvedValue({
      t: (key: string) => ({
        "profile.returns.selectAtLeastOne": "Select at least one item to return.",
        "profile.returns.rateLimited": "Too many return requests. Please try again shortly.",
        "profile.returns.genericFailed": "Could not submit the return request.",
      })[key] ?? key,
    });
  });

  it("returns the translated validation message for an empty selection", async () => {
    const response = await POST(request({ orderId: "order-1", lineItems: [] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "Select at least one item to return." });
  });

  it("returns the translated rate-limit message", async () => {
    mocks.checkRateLimit.mockResolvedValue({ ok: false, retryAfterSeconds: 30 });

    const response = await POST(request({ orderId: "order-1", lineItems: [{ lineItemId: "li-1", quantity: 1 }] }));

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ ok: false, error: "Too many return requests. Please try again shortly." });
  });

  it("passes through Shopify's own dynamic rejection reason instead of the generic fallback", async () => {
    mocks.requestShopifyOrderReturn.mockRejectedValue(new Error("This item is not eligible for return."));

    const response = await POST(request({ orderId: "order-1", lineItems: [{ lineItemId: "li-1", quantity: 1 }] }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ ok: false, error: "This item is not eligible for return." });
  });
});
