import { describe, expect, it } from "vitest";

import { ShopifyAdminError } from "@/lib/shopify/admin";
import {
  FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE,
  FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE,
  FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE,
  FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE,
  freeShippingThresholdReadErrorMessage,
} from "@/lib/shopify/free-shipping-threshold";

describe("freeShippingThresholdReadErrorMessage", () => {
  it("maps ACCESS_DENIED GraphQL errors to the read_shipping permission reason", () => {
    const error = new ShopifyAdminError("Access denied for deliveryProfiles field.", [
      {
        message: "Access denied for deliveryProfiles field. Required access: `read_shipping`",
        extensions: { code: "ACCESS_DENIED" },
      },
    ]);
    expect(freeShippingThresholdReadErrorMessage(error)).toBe(
      FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE,
    );
  });

  it("maps markets ACCESS_DENIED to the read_markets permission reason", () => {
    const error = new ShopifyAdminError("Access denied for markets field.", [
      {
        message: "Access denied for markets field. Required access: `read_markets`",
        extensions: { code: "ACCESS_DENIED" },
      },
    ]);
    expect(freeShippingThresholdReadErrorMessage(error)).toBe(
      FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE,
    );
  });

  it("keeps a pre-normalized read_markets reason (does not remap to read_shipping)", () => {
    expect(
      freeShippingThresholdReadErrorMessage(
        new ShopifyAdminError(FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE),
      ),
    ).toBe(FREE_SHIPPING_THRESHOLD_MISSING_MARKETS_SCOPE_MESSAGE);
  });

  it("maps generic shipping access failures to the read_shipping permission reason", () => {
    const error = new ShopifyAdminError("This app is not approved to access the shipping object.");
    expect(freeShippingThresholdReadErrorMessage(error)).toBe(
      FREE_SHIPPING_THRESHOLD_MISSING_SCOPE_MESSAGE,
    );
  });

  it("keeps other Shopify Admin errors as the raw message", () => {
    const error = new ShopifyAdminError("Unable to reach Shopify: timeout");
    expect(freeShippingThresholdReadErrorMessage(error)).toBe("Unable to reach Shopify: timeout");
  });

  it("exports a stable not-found reason for empty Portugal free rates", () => {
    expect(FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE).toMatch(/Portugal \(PT\)/);
    expect(FREE_SHIPPING_THRESHOLD_NOT_FOUND_MESSAGE).not.toMatch(/Not checked yet/i);
  });

  it("exports a stable no-Portugal-market reason", () => {
    expect(FREE_SHIPPING_THRESHOLD_NO_PORTUGAL_MARKET_MESSAGE).toMatch(/Portugal \(PT\) market/);
  });
});
