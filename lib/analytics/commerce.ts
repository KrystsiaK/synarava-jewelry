export const COMMERCE_EVENT_NAME = "synarava:commerce-event";

export type CommerceEvent =
  | "department_entry"
  | "view_item"
  | "add_to_cart"
  | "checkout_started"
  | "checkout_completed";

export type CommerceEventDetail = {
  event: CommerceEvent;
  properties: Record<string, boolean | number | string | null | undefined>;
  schemaVersion: 1;
};

/**
 * Emits a first-party browser event without storing or transmitting data.
 * A consent-aware analytics adapter can subscribe to this event later.
 */
export function trackCommerceEvent(
  event: CommerceEvent,
  properties: CommerceEventDetail["properties"] = {},
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CommerceEventDetail>(COMMERCE_EVENT_NAME, {
      detail: { event, properties, schemaVersion: 1 },
    }),
  );
}
