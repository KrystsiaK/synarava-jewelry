import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyShopifyWebhook: vi.fn(),
  claimOrdersPaidDelivery: vi.fn(),
  markOrdersPaidDeliverySucceeded: vi.fn(),
  markOrdersPaidDeliveryFailed: vi.fn(),
  logOrdersPaidSignal: vi.fn(),
  summarizeOrdersPaidPayload: vi.fn(),
  paidOrderStockLinesFromPayload: vi.fn(),
  decrementStockForPaidOrderLines: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ env: { SHOPIFY_WEBHOOK_SECRET: "secret" } }));
vi.mock("@/lib/shopify/webhooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/shopify/webhooks")>();
  return {
    ...actual,
    verifyShopifyWebhook: mocks.verifyShopifyWebhook,
  };
});
vi.mock("@/lib/db", () => ({
  db: {
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/commerce/order-stock-decrement", () => ({
  paidOrderStockLinesFromPayload: mocks.paidOrderStockLinesFromPayload,
  decrementStockForPaidOrderLines: mocks.decrementStockForPaidOrderLines,
}));
vi.mock("@/lib/shopify/orders-paid-webhook", () => ({
  claimOrdersPaidDelivery: mocks.claimOrdersPaidDelivery,
  markOrdersPaidDeliverySucceeded: mocks.markOrdersPaidDeliverySucceeded,
  markOrdersPaidDeliveryFailed: mocks.markOrdersPaidDeliveryFailed,
  logOrdersPaidSignal: mocks.logOrdersPaidSignal,
  summarizeOrdersPaidPayload: mocks.summarizeOrdersPaidPayload,
}));

import { POST } from "../route";

function request(payload: unknown) {
  return new Request("https://shop.synarava.com/api/shopify/webhooks/orders/paid", {
    method: "POST",
    headers: {
      "x-shopify-hmac-sha256": "valid",
      "x-shopify-webhook-id": "webhook-paid-1",
      "x-shopify-topic": "orders/paid",
    },
    body: JSON.stringify(payload),
  });
}

const signal = {
  shopifyOrderId: "gid://shopify/Order/1",
  orderName: "#1001",
  financialStatus: "paid",
  currency: "EUR",
  totalPrice: "42.00",
};

const stockLines = [
  { shopifyVariantId: "gid://shopify/ProductVariant/10", quantity: 2 },
];

describe("ORDERS_PAID webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyShopifyWebhook.mockReturnValue(true);
    mocks.summarizeOrdersPaidPayload.mockReturnValue(signal);
    mocks.claimOrdersPaidDelivery.mockResolvedValue({ id: "delivery-1" });
    mocks.markOrdersPaidDeliverySucceeded.mockResolvedValue(undefined);
    mocks.paidOrderStockLinesFromPayload.mockReturnValue(stockLines);
    mocks.decrementStockForPaidOrderLines.mockResolvedValue({ decremented: 1, ignored: 0 });
    mocks.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn({}));
  });

  it("rejects invalid HMAC before claiming a delivery", async () => {
    mocks.verifyShopifyWebhook.mockReturnValue(false);
    const response = await POST(request({ id: 1 }));
    expect(response.status).toBe(401);
    expect(mocks.claimOrdersPaidDelivery).not.toHaveBeenCalled();
  });

  it("rejects missing webhook id with 400 before claim (REL-003)", async () => {
    const response = await POST(
      new Request("https://shop.synarava.com/api/shopify/webhooks/orders/paid", {
        method: "POST",
        headers: {
          "x-shopify-hmac-sha256": "valid",
          "x-shopify-topic": "orders/paid",
        },
        body: JSON.stringify({ id: 1, name: "#1001", financial_status: "paid" }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing Shopify webhook id." });
    expect(mocks.claimOrdersPaidDelivery).not.toHaveBeenCalled();
  });

  it("decrements stock and succeeds on first paid delivery", async () => {
    const payload = { id: 1, name: "#1001", financial_status: "paid", line_items: [] };
    const response = await POST(request(payload));
    expect(response.status).toBe(200);
    expect(mocks.paidOrderStockLinesFromPayload).toHaveBeenCalledWith(payload);
    expect(mocks.decrementStockForPaidOrderLines).toHaveBeenCalledWith(stockLines, expect.anything());
    expect(mocks.markOrdersPaidDeliverySucceeded).toHaveBeenCalledWith("delivery-1", expect.anything());
    expect(mocks.logOrdersPaidSignal).toHaveBeenCalledWith({
      webhookId: "webhook-paid-1",
      topic: "orders/paid",
      signal,
    });
  });

  it("returns duplicate without decrementing when claim fails", async () => {
    mocks.claimOrdersPaidDelivery.mockResolvedValue(null);
    const response = await POST(request({ id: 1 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, duplicate: true });
    expect(mocks.logOrdersPaidSignal).toHaveBeenCalledWith(
      expect.objectContaining({ duplicate: true }),
    );
    expect(mocks.decrementStockForPaidOrderLines).not.toHaveBeenCalled();
    expect(mocks.markOrdersPaidDeliverySucceeded).not.toHaveBeenCalled();
  });
});
