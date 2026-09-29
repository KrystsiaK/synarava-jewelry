/**
 * Buyer-facing order status + action resolution from Customer Account API fields.
 * Shopify remains SoT — this only maps live CAA payloads to chips/actions.
 * @see https://shopify.dev/docs/api/customer/latest/objects/Order
 */

export type OrderStatusTone = "neutral" | "success" | "warning" | "danger" | "info";

export type OrderStatusChip = {
  kind: "payment" | "fulfillment" | "cancel" | "refund" | "return" | "shipment";
  /** Absolute i18n key under profile.orders.* */
  labelKey: string;
  tone: OrderStatusTone;
  /** Optional cancel-reason detail key when kind === "cancel" */
  detailKey?: string;
};

export type OrderBuyerAction =
  | { type: "track"; href: string; labelKey: "profile.orders.trackPackage" }
  | { type: "payNow"; href: string; labelKey: "profile.orders.actions.payNow" }
  | { type: "cancelRequest"; href: string; labelKey: "profile.orders.actions.cancelRequest" }
  | { type: "manage"; href: string; labelKey: "profile.orders.manageOrder" }
  | { type: "returnRequest"; href: string; labelKey: "profile.returns.request"; mode: "shopify" }
  | {
      type: "buyAgain";
      available: true;
      href: string;
      labelKey: "profile.orders.actions.buyAgain";
    }
  | {
      type: "buyAgain";
      available: false;
      labelKey: "profile.orders.actions.buyAgainUnavailable";
      hintKey: "profile.orders.buyAgainFrozenHint";
    };

export type AccountOrdersActionSettings = {
  /** When true, profile may offer headless cart-permalink Buy again (ops freeze default: off). */
  buyAgainOnOrdersEnabled: boolean;
};

export type OrderStatusInput = {
  financialStatus: string | null;
  fulfillmentStatus: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  statusPageUrl: string;
  totalRefundedAmount: number;
  paymentCollectionUrl: string | null;
  fulfillments: Array<{
    latestShipmentStatus: string | null;
    trackingUrl: string | null;
  }>;
  returns: Array<{ status: string }>;
  hasReturnableItems: boolean;
  /** Numeric Shopify variant ids with quantities for optional Buy again permalink. */
  buyAgainLines: Array<{ variantId: string; quantity: number }>;
};

const FINANCIAL_KEYS = new Set([
  "AUTHORIZED",
  "EXPIRED",
  "PAID",
  "PARTIALLY_PAID",
  "PARTIALLY_REFUNDED",
  "PENDING",
  "REFUNDED",
  "VOIDED",
]);

const FULFILLMENT_KEYS = new Set([
  "FULFILLED",
  "IN_PROGRESS",
  "ON_HOLD",
  "OPEN",
  "PARTIALLY_FULFILLED",
  "PENDING_FULFILLMENT",
  "RESTOCKED",
  "SCHEDULED",
  "UNFULFILLED",
]);

const CANCEL_REASON_KEYS = new Set([
  "CUSTOMER",
  "DECLINED",
  "FRAUD",
  "INVENTORY",
  "OTHER",
  "STAFF",
]);

const RETURN_STATUS_KEYS = new Set([
  "CANCELED",
  "CLOSED",
  "DECLINED",
  "OPEN",
  "REQUESTED",
]);

const SHIPMENT_KEYS = new Set([
  "ATTEMPTED_DELIVERY",
  "CONFIRMED",
  "DELIVERED",
  "FAILURE",
  "IN_TRANSIT",
  "LABEL_PRINTED",
  "LABEL_PURCHASED",
  "OUT_FOR_DELIVERY",
  "READY_FOR_PICKUP",
  "SUBMITTED",
]);

function normalizeEnum(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, "_");
}

function financialTone(status: string): OrderStatusTone {
  switch (status) {
    case "PAID":
      return "success";
    case "PENDING":
    case "AUTHORIZED":
    case "PARTIALLY_PAID":
      return "warning";
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return "info";
    case "VOIDED":
    case "EXPIRED":
      return "danger";
    default:
      return "neutral";
  }
}

function fulfillmentTone(status: string): OrderStatusTone {
  switch (status) {
    case "FULFILLED":
      return "success";
    case "PARTIALLY_FULFILLED":
    case "IN_PROGRESS":
    case "PENDING_FULFILLMENT":
    case "SCHEDULED":
      return "info";
    case "ON_HOLD":
      return "warning";
    case "UNFULFILLED":
    case "OPEN":
    case "RESTOCKED":
      return "neutral";
    default:
      return "neutral";
  }
}

function returnTone(status: string): OrderStatusTone {
  switch (status) {
    case "CLOSED":
      return "success";
    case "REQUESTED":
    case "OPEN":
      return "info";
    case "DECLINED":
    case "CANCELED":
      return "warning";
    default:
      return "neutral";
  }
}

/** Extract numeric ProductVariant id from a CAA GID or raw digits. */
export function numericVariantId(variantId: string | null | undefined): string | null {
  if (!variantId) return null;
  const trimmed = variantId.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = /^gid:\/\/shopify\/ProductVariant\/(\d+)$/i.exec(trimmed);
  return match?.[1] ?? null;
}

export function buildBuyAgainPermalink(
  lines: Array<{ variantId: string; quantity: number }>,
): string | null {
  const quantities = new Map<string, number>();
  for (const line of lines) {
    const id = numericVariantId(line.variantId);
    if (!id || line.quantity < 1) continue;
    quantities.set(id, (quantities.get(id) ?? 0) + line.quantity);
  }
  if (quantities.size === 0) return null;
  return [...quantities.entries()]
    .sort((a, b) => (BigInt(a[0]) < BigInt(b[0]) ? -1 : BigInt(a[0]) > BigInt(b[0]) ? 1 : 0))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(",");
}

/**
 * Map a live Customer Account order into status chips + buyer actions.
 * Cancel / pay / return deep-link to Shopify when native; Buy again respects ops freeze settings.
 */
export function resolveOrderStatusView(
  order: OrderStatusInput,
  settings: AccountOrdersActionSettings = { buyAgainOnOrdersEnabled: false },
): { chips: OrderStatusChip[]; actions: OrderBuyerAction[] } {
  const chips: OrderStatusChip[] = [];
  const cancelled = Boolean(order.cancelledAt);

  if (cancelled) {
    const reason = normalizeEnum(order.cancelReason);
    chips.push({
      kind: "cancel",
      labelKey: "profile.orders.status.cancelled",
      tone: "danger",
      detailKey: CANCEL_REASON_KEYS.has(reason)
        ? `profile.orders.cancelReason.${reason}`
        : undefined,
    });
  }

  const financial = normalizeEnum(order.financialStatus);
  if (financial) {
    chips.push({
      kind: "payment",
      labelKey: FINANCIAL_KEYS.has(financial)
        ? `profile.orders.status.payment.${financial}`
        : "profile.orders.status.payment.UNKNOWN",
      tone: financialTone(financial),
    });
  }

  // Dedicated refund chip when financial status alone does not already say refunded,
  // but money was refunded (edge / partial timing).
  if (
    order.totalRefundedAmount > 0 &&
    financial !== "REFUNDED" &&
    financial !== "PARTIALLY_REFUNDED"
  ) {
    chips.push({
      kind: "refund",
      labelKey: "profile.orders.status.refundedAmount",
      tone: "info",
    });
  }

  if (!cancelled) {
    const fulfillment = normalizeEnum(order.fulfillmentStatus);
    chips.push({
      kind: "fulfillment",
      labelKey: FULFILLMENT_KEYS.has(fulfillment)
        ? `profile.orders.status.fulfillment.${fulfillment}`
        : "profile.orders.status.fulfillment.UNKNOWN",
      tone: fulfillmentTone(fulfillment),
    });
  }

  const seenReturns = new Set<string>();
  for (const ret of order.returns) {
    const status = normalizeEnum(ret.status);
    if (!status || seenReturns.has(status)) continue;
    seenReturns.add(status);
    chips.push({
      kind: "return",
      labelKey: RETURN_STATUS_KEYS.has(status)
        ? `profile.orders.status.return.${status}`
        : "profile.orders.status.return.UNKNOWN",
      tone: returnTone(status),
    });
  }

  const seenShipments = new Set<string>();
  for (const fulfillment of order.fulfillments) {
    const shipment = normalizeEnum(fulfillment.latestShipmentStatus);
    if (!shipment || seenShipments.has(shipment)) continue;
    seenShipments.add(shipment);
    chips.push({
      kind: "shipment",
      labelKey: SHIPMENT_KEYS.has(shipment)
        ? `profile.orders.status.shipment.${shipment}`
        : "profile.orders.status.shipment.UNKNOWN",
      tone: shipment === "DELIVERED" ? "success" : shipment === "FAILURE" ? "danger" : "info",
    });
  }

  const actions: OrderBuyerAction[] = [];

  const trackingUrl = order.fulfillments.map((f) => f.trackingUrl).find(Boolean) ?? null;
  if (trackingUrl) {
    actions.push({
      type: "track",
      href: trackingUrl,
      labelKey: "profile.orders.trackPackage",
    });
  }

  if (order.paymentCollectionUrl && !cancelled) {
    const outstandingPayment =
      financial === "PENDING" ||
      financial === "PARTIALLY_PAID" ||
      financial === "AUTHORIZED" ||
      financial === "EXPIRED";
    if (outstandingPayment) {
      actions.push({
        type: "payNow",
        href: order.paymentCollectionUrl,
        labelKey: "profile.orders.actions.payNow",
      });
    }
  }

  const fulfillment = normalizeEnum(order.fulfillmentStatus);
  const canRequestCancel =
    !cancelled &&
    (fulfillment === "UNFULFILLED" ||
      fulfillment === "OPEN" ||
      fulfillment === "ON_HOLD" ||
      fulfillment === "SCHEDULED" ||
      fulfillment === "PARTIALLY_FULFILLED" ||
      fulfillment === "IN_PROGRESS" ||
      fulfillment === "PENDING_FULFILLMENT");
  if (canRequestCancel) {
    actions.push({
      type: "cancelRequest",
      href: order.statusPageUrl,
      labelKey: "profile.orders.actions.cancelRequest",
    });
  }

  if (!cancelled && order.hasReturnableItems) {
    actions.push({
      type: "returnRequest",
      href: order.statusPageUrl,
      labelKey: "profile.returns.request",
      mode: "shopify",
    });
  }

  if (settings.buyAgainOnOrdersEnabled) {
    const permalink = buildBuyAgainPermalink(order.buyAgainLines);
    if (permalink) {
      actions.push({
        type: "buyAgain",
        available: true,
        href: permalink,
        labelKey: "profile.orders.actions.buyAgain",
      });
    } else {
      actions.push({
        type: "buyAgain",
        available: false,
        labelKey: "profile.orders.actions.buyAgainUnavailable",
        hintKey: "profile.orders.buyAgainFrozenHint",
      });
    }
  } else {
    actions.push({
      type: "buyAgain",
      available: false,
      labelKey: "profile.orders.actions.buyAgainUnavailable",
      hintKey: "profile.orders.buyAgainFrozenHint",
    });
  }

  actions.push({
    type: "manage",
    href: order.statusPageUrl,
    labelKey: "profile.orders.manageOrder",
  });

  return { chips, actions };
}
