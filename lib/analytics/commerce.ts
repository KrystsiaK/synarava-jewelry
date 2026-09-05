export const COMMERCE_EVENT_NAME = "synarava:commerce-event";

export type CommerceEvent =
  | "department_entry"
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "checkout_completed";

export type CommerceItem = {
  item_id: string;
  item_name?: string;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_list_name?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
};

export type CommerceEcommerce = {
  currency?: string;
  value?: number;
  items: CommerceItem[];
};

export type CommerceEventDetail = {
  event: CommerceEvent;
  properties: Record<string, unknown>;
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
