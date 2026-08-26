import { describe, expect, it, vi } from "vitest";

import {
  COMMERCE_EVENT_NAME,
  trackCommerceEvent,
  type CommerceEventDetail,
} from "../commerce";

describe("commerce analytics event layer", () => {
  it("emits a typed first-party event without an external request", () => {
    const listener = vi.fn<(event: Event) => void>();
    window.addEventListener(COMMERCE_EVENT_NAME, listener);

    trackCommerceEvent("add_to_cart", {
      productSlug: "silver-ring",
      quantity: 1,
    });

    expect(listener).toHaveBeenCalledOnce();
    expect((listener.mock.calls[0][0] as CustomEvent<CommerceEventDetail>).detail).toEqual({
      event: "add_to_cart",
      properties: { productSlug: "silver-ring", quantity: 1 },
      schemaVersion: 1,
    });

    window.removeEventListener(COMMERCE_EVENT_NAME, listener);
  });
});
