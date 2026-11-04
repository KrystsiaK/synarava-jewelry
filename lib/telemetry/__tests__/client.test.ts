import { beforeEach, describe, expect, it, vi } from "vitest";

import { COMMERCE_EVENT_NAME } from "@/lib/analytics/commerce";
import {
  initializeClientTelemetry,
  publishClientTelemetry,
} from "../client";
import {
  createPrivacyConsent,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
} from "@/lib/privacy/consent";

type TestWindow = Window & {
  dataLayer?: Array<Record<string, unknown>>;
  __synaravaTelemetryInitialized?: boolean;
  clarity?: ReturnType<typeof vi.fn>;
};

describe("client telemetry", () => {
  beforeEach(() => {
    const target = window as TestWindow;
    target.dataLayer = [];
    target.__synaravaTelemetryInitialized = false;
    delete target.clarity;
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
  });

  function allowAnalytics() {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=${serializePrivacyConsent(createPrivacyConsent({
      preferences: false,
      analytics: true,
      marketing: false,
    }))}; Path=/`;
  }

  it("forwards commerce events without unsafe or undefined properties", () => {
    allowAnalytics();
    initializeClientTelemetry();

    window.dispatchEvent(new CustomEvent(COMMERCE_EVENT_NAME, {
      detail: {
        event: "add_to_cart",
        schemaVersion: 1,
        properties: {
          ecommerce: {
            currency: "EUR",
            value: 120,
            items: [{
              item_id: "RING-1",
              item_name: "Silver ring",
              price: 120,
              quantity: 1,
              email: "must-not-leave@example.com",
            }],
          },
          metadata: {
            productSlug: "silver-ring",
            cartId: "gid://shopify/Cart/secret?key=secret",
            optional: undefined,
          },
        },
      },
    }));

    expect((window as TestWindow).dataLayer).toEqual([
      { ecommerce: null },
      {
        event: "add_to_cart",
        ecommerce: {
          currency: "EUR",
          value: 120,
          items: [{
            item_id: "RING-1",
            item_name: "Silver ring",
            price: 120,
            quantity: 1,
          }],
        },
        synarava: {
          schemaVersion: 1,
          productSlug: "silver-ring",
        },
      },
    ]);
  });

  it("initializes global listeners only once", () => {
    allowAnalytics();
    initializeClientTelemetry();
    initializeClientTelemetry();

    publishClientTelemetry("navigation_start", {
      path: "/products/silver-ring",
      navigationType: "push",
    });

    expect((window as TestWindow).dataLayer).toHaveLength(1);
  });

  it("does not queue telemetry before analytics consent", () => {
    initializeClientTelemetry();
    publishClientTelemetry("navigation_start", { path: "/shop" });
    window.dispatchEvent(new CustomEvent(COMMERCE_EVENT_NAME, {
      detail: { event: "view_item", schemaVersion: 1, properties: { productSlug: "ring" } },
    }));

    expect((window as TestWindow).dataLayer).toEqual([]);
  });

  it("never forwards a storefront checkout completion as purchase", () => {
    allowAnalytics();
    initializeClientTelemetry();

    window.dispatchEvent(new CustomEvent(COMMERCE_EVENT_NAME, {
      detail: {
        event: "checkout_completed",
        schemaVersion: 1,
        properties: { orderId: "legacy-stripe-order" },
      },
    }));

    expect((window as TestWindow).dataLayer).toEqual([]);
  });

  it("mirrors GA ecommerce events to Clarity event/upgrade without payloads", () => {
    allowAnalytics();
    const clarity = vi.fn();
    (window as TestWindow).clarity = clarity;
    initializeClientTelemetry();

    window.dispatchEvent(new CustomEvent(COMMERCE_EVENT_NAME, {
      detail: {
        event: "add_to_cart",
        schemaVersion: 1,
        properties: {
          ecommerce: {
            currency: "EUR",
            value: 120,
            items: [{ item_id: "RING-1", item_name: "Silver ring", price: 120, quantity: 1 }],
          },
          metadata: { productSlug: "silver-ring", email: "hidden@example.com" },
        },
      },
    }));

    expect(clarity).toHaveBeenCalledWith("event", "add_to_cart");
    expect(clarity).toHaveBeenCalledWith("upgrade", "add_to_cart");
    for (const call of clarity.mock.calls) {
      expect(JSON.stringify(call)).not.toMatch(/email|EUR|120|Silver|ecommerce/i);
    }
  });

  it("does not call Clarity for commerce events without analytics consent", () => {
    const clarity = vi.fn();
    (window as TestWindow).clarity = clarity;
    initializeClientTelemetry();

    window.dispatchEvent(new CustomEvent(COMMERCE_EVENT_NAME, {
      detail: {
        event: "begin_checkout",
        schemaVersion: 1,
        properties: {
          ecommerce: {
            currency: "EUR",
            value: 50,
            items: [{ item_id: "RING-1", quantity: 1 }],
          },
        },
      },
    }));

    expect(clarity).not.toHaveBeenCalled();
  });
});
