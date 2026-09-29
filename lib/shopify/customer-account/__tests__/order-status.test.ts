import { describe, expect, it } from "vitest";

import {
  buildBuyAgainPermalink,
  numericVariantId,
  resolveOrderStatusView,
  type OrderStatusInput,
} from "../order-status";

function baseOrder(overrides: Partial<OrderStatusInput> = {}): OrderStatusInput {
  return {
    financialStatus: "PAID",
    fulfillmentStatus: "FULFILLED",
    cancelledAt: null,
    cancelReason: null,
    statusPageUrl: "https://account.example/orders/1",
    totalRefundedAmount: 0,
    paymentCollectionUrl: null,
    fulfillments: [],
    returns: [],
    hasReturnableItems: false,
    buyAgainLines: [],
    ...overrides,
  };
}

describe("numericVariantId", () => {
  it("accepts GIDs and bare digits", () => {
    expect(numericVariantId("gid://shopify/ProductVariant/66048797442397")).toBe("66048797442397");
    expect(numericVariantId("123")).toBe("123");
    expect(numericVariantId("gid://shopify/Product/1")).toBeNull();
  });
});

describe("buildBuyAgainPermalink", () => {
  it("merges quantities and sorts variant ids", () => {
    expect(
      buildBuyAgainPermalink([
        { variantId: "gid://shopify/ProductVariant/20", quantity: 1 },
        { variantId: "10", quantity: 2 },
        { variantId: "gid://shopify/ProductVariant/20", quantity: 1 },
      ]),
    ).toBe("10:2,20:2");
  });
});

describe("resolveOrderStatusView", () => {
  it("surfaces payment, fulfillment, cancel, refund, and return chips", () => {
    const cancelled = resolveOrderStatusView(
      baseOrder({
        cancelledAt: "2026-01-02T00:00:00.000Z",
        cancelReason: "CUSTOMER",
        financialStatus: "VOIDED",
        fulfillmentStatus: "UNFULFILLED",
      }),
    );
    expect(cancelled.chips.map((c) => c.labelKey)).toEqual([
      "profile.orders.status.cancelled",
      "profile.orders.status.payment.VOIDED",
    ]);
    expect(cancelled.chips[0]?.detailKey).toBe("profile.orders.cancelReason.CUSTOMER");

    const pending = resolveOrderStatusView(
      baseOrder({
        financialStatus: "PENDING",
        fulfillmentStatus: "UNFULFILLED",
        paymentCollectionUrl: "https://pay.example/1",
      }),
    );
    expect(pending.chips.some((c) => c.labelKey === "profile.orders.status.payment.PENDING")).toBe(true);
    expect(pending.actions.some((a) => a.type === "payNow")).toBe(true);

    const refunded = resolveOrderStatusView(
      baseOrder({
        financialStatus: "PARTIALLY_REFUNDED",
        fulfillmentStatus: "FULFILLED",
        totalRefundedAmount: 5,
        hasReturnableItems: true,
        returns: [{ status: "REQUESTED" }],
      }),
    );
    expect(refunded.chips.map((c) => c.labelKey)).toContain("profile.orders.status.payment.PARTIALLY_REFUNDED");
    expect(refunded.chips.map((c) => c.labelKey)).toContain("profile.orders.status.return.REQUESTED");
    expect(refunded.actions.some((a) => a.type === "returnRequest")).toBe(true);
  });

  it("offers cancel request for open fulfillments and freezes Buy again by default", () => {
    const view = resolveOrderStatusView(
      baseOrder({
        fulfillmentStatus: "UNFULFILLED",
        buyAgainLines: [{ variantId: "gid://shopify/ProductVariant/1", quantity: 1 }],
      }),
    );
    expect(view.actions.some((a) => a.type === "cancelRequest")).toBe(true);
    const buyAgain = view.actions.find((a) => a.type === "buyAgain");
    expect(buyAgain).toMatchObject({ available: false });
  });

  it("enables Buy again permalink when the settings toggle is on", () => {
    const view = resolveOrderStatusView(
      baseOrder({
        buyAgainLines: [{ variantId: "gid://shopify/ProductVariant/99", quantity: 2 }],
      }),
      { buyAgainOnOrdersEnabled: true },
    );
    const buyAgain = view.actions.find((a) => a.type === "buyAgain");
    expect(buyAgain).toMatchObject({ available: true, href: "99:2" });
  });

  it("maps Multibanco-style pending payment without inventing a local Order store", () => {
    const view = resolveOrderStatusView(
      baseOrder({
        financialStatus: "pending",
        fulfillmentStatus: "unfulfilled",
        paymentCollectionUrl: "https://shop.example/pay",
      }),
    );
    expect(view.chips.find((c) => c.kind === "payment")?.labelKey).toBe(
      "profile.orders.status.payment.PENDING",
    );
    expect(view.actions.find((a) => a.type === "payNow")?.href).toBe("https://shop.example/pay");
  });
});
