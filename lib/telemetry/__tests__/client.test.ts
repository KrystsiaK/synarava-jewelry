import { beforeEach, describe, expect, it } from "vitest";

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
};

describe("client telemetry", () => {
  beforeEach(() => {
    const target = window as TestWindow;
    target.dataLayer = [];
    target.__synaravaTelemetryInitialized = false;
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
          productSlug: "silver-ring",
          merchandiseId: "gid://shopify/ProductVariant/1",
          quantity: 1,
          email: "must-not-leave@example.com",
          cartId: "gid://shopify/Cart/secret?key=secret",
          optional: undefined,
        },
      },
    }));

    expect((window as TestWindow).dataLayer).toEqual([
      {
        event: "add_to_cart",
        synarava: {
          schemaVersion: 1,
          productSlug: "silver-ring",
          merchandiseId: "gid://shopify/ProductVariant/1",
          quantity: 1,
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
});
