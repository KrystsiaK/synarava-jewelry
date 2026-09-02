import {
  COMMERCE_EVENT_NAME,
  type CommerceEventDetail,
} from "@/lib/analytics/commerce";

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

function telemetryWindow(): TelemetryWindow | null {
  return typeof window === "undefined" ? null : window as TelemetryWindow;
}
function pushDataLayer(entry: DataLayerEntry) {
  const target = telemetryWindow();
  if (!target) return;

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
      !BLOCKED_COMMERCE_KEYS.has(key) && value !== undefined
    )),
  );
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
