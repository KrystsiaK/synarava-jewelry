import {
  COMMERCE_EVENT_NAME,
  type CommerceEventDetail,
  type CommerceEcommerce,
  type CommerceItem,
} from "@/lib/analytics/commerce";
import { hasAnalyticsConsent } from "@/lib/privacy/consent";

type DataLayerEntry = Record<string, unknown>;

type TelemetryWindow = Window & {
  dataLayer?: DataLayerEntry[];
  __synaravaTelemetryInitialized?: boolean;
};

export type ClientTelemetryKind =
  | "client_error"
  | "unhandled_rejection"
  | "navigation_start"
  | "web_vital";

const BLOCKED_COMMERCE_KEYS = new Set([
  "address",
  "address1",
  "address2",
  "cartId",
  "checkoutUrl",
  "customerId",
  "email",
  "firstName",
  "fullName",
  "lastName",
  "notes",
  "phone",
]);

const GA4_ECOMMERCE_EVENTS = new Set(["view_item", "add_to_cart", "begin_checkout"]);
const GA4_ITEM_KEYS = new Set<keyof CommerceItem>([
  "item_id",
  "item_name",
  "item_brand",
  "item_category",
  "item_category2",
  "item_list_name",
  "item_variant",
  "price",
  "quantity",
]);

function telemetryWindow(): TelemetryWindow | null {
  return typeof window === "undefined" ? null : window as TelemetryWindow;
}
function pushDataLayer(entry: DataLayerEntry) {
  const target = telemetryWindow();
  if (!target || !hasAnalyticsConsent()) return;

  target.dataLayer ??= [];
  target.dataLayer.push(entry);
}

function safePath(value: string | null | undefined) {
  if (!value) return null;

  try {
    return new URL(value, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function sanitizeCommerceProperties(
  properties: CommerceEventDetail["properties"],
) {
  return Object.fromEntries(
    Object.entries(properties).filter(([key, value]) => (
      !BLOCKED_COMMERCE_KEYS.has(key)
      && (value === null
        || typeof value === "boolean"
        || typeof value === "number"
        || typeof value === "string")
    )),
  );
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function shortString(value: unknown) {
  return typeof value === "string" && value.length <= 300 ? value : undefined;
}

function sanitizeCommerceItem(value: unknown): CommerceItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const itemId = shortString(source.item_id);
  if (!itemId) return null;

  const item: Record<string, string | number> = { item_id: itemId };
  for (const key of GA4_ITEM_KEYS) {
    if (key === "item_id") continue;
    const next = key === "price" || key === "quantity"
      ? finiteNumber(source[key])
      : shortString(source[key]);
    if (next !== undefined) item[key] = next;
  }
  return item as CommerceItem;
}

function sanitizeEcommerce(value: unknown): CommerceEcommerce | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const items = Array.isArray(source.items)
    ? source.items.slice(0, 100).map(sanitizeCommerceItem).filter((item): item is CommerceItem => Boolean(item))
    : [];
  if (items.length === 0) return null;

  const ecommerce: CommerceEcommerce = { items };
  const currency = shortString(source.currency);
  const amount = finiteNumber(source.value);
  if (currency) ecommerce.currency = currency;
  if (amount !== undefined) ecommerce.value = amount;
  return ecommerce;
}

function isCommerceEventDetail(value: unknown): value is CommerceEventDetail {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CommerceEventDetail>;
  return (
    typeof candidate.event === "string"
    && candidate.schemaVersion === 1
    && Boolean(candidate.properties)
    && typeof candidate.properties === "object"
  );
}

function forwardCommerceEvent(event: Event) {
  if (!(event instanceof CustomEvent) || !isCommerceEventDetail(event.detail)) return;

  // A completed purchase is intentionally never sourced from the storefront.
  // Shopify's consent-aware checkout_completed customer event is authoritative.
  if (event.detail.event === "checkout_completed") return;

  if (GA4_ECOMMERCE_EVENTS.has(event.detail.event)) {
    const ecommerce = sanitizeEcommerce(event.detail.properties.ecommerce);
    if (!ecommerce) return;
    pushDataLayer({ ecommerce: null });
    pushDataLayer({
      event: event.detail.event,
      ecommerce,
      synarava: {
        schemaVersion: event.detail.schemaVersion,
        ...sanitizeCommerceProperties(
          (event.detail.properties.metadata as Record<string, unknown> | undefined) ?? {},
        ),
      },
    });
    return;
  }

  pushDataLayer({
    event: event.detail.event,
    synarava: {
      schemaVersion: event.detail.schemaVersion,
      ...sanitizeCommerceProperties(event.detail.properties),
    },
  });
}

export function publishClientTelemetry(
  kind: ClientTelemetryKind,
  properties: Record<string, boolean | number | string | null | undefined> = {},
) {
  pushDataLayer({
    event: "synarava_telemetry",
    telemetry: {
      kind,
      schemaVersion: 1,
      ...Object.fromEntries(
        Object.entries(properties).filter(([, value]) => value !== undefined),
      ),
    },
  });
}

function captureClientError(event: ErrorEvent) {
  publishClientTelemetry("client_error", {
    errorType: event.error instanceof Error ? event.error.name : "Error",
    sourcePath: safePath(event.filename),
    line: event.lineno || null,
    column: event.colno || null,
  });
}

function captureUnhandledRejection(event: PromiseRejectionEvent) {
  publishClientTelemetry("unhandled_rejection", {
    errorType: event.reason instanceof Error
      ? event.reason.name
      : typeof event.reason,
  });
}

export function initializeClientTelemetry() {
  const target = telemetryWindow();
  if (!target || target.__synaravaTelemetryInitialized) return;
  target.__synaravaTelemetryInitialized = true;

  target.addEventListener(COMMERCE_EVENT_NAME, forwardCommerceEvent);
  target.addEventListener("error", captureClientError);
  target.addEventListener("unhandledrejection", captureUnhandledRejection);
}
