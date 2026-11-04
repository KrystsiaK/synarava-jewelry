import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPrivacyConsent,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
} from "@/lib/privacy/consent";

type ClarityWindow = Window & {
  clarity?: ReturnType<typeof vi.fn>;
};

describe("clarity telemetry helpers", () => {
  beforeEach(() => {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
    delete (window as ClarityWindow).clarity;
    vi.resetModules();
  });

  afterEach(() => {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=; Path=/; Max-Age=0`;
    delete (window as ClarityWindow).clarity;
  });

  function allowAnalytics() {
    document.cookie = `${PRIVACY_CONSENT_COOKIE}=${serializePrivacyConsent(createPrivacyConsent({
      preferences: false,
      analytics: true,
      marketing: false,
    }))}; Path=/`;
  }

  async function loadClarity() {
    return import("../clarity");
  }

  it("calls window.clarity event/upgrade/set when consent and clarity exist", async () => {
    allowAnalytics();
    const clarity = vi.fn();
    (window as ClarityWindow).clarity = clarity;

    const { clarityEvent, clarityTag, clarityUpgrade } = await loadClarity();
    clarityEvent("add_to_cart");
    clarityUpgrade("add_to_cart");
    clarityTag("locale", "pt");

    expect(clarity).toHaveBeenCalledWith("event", "add_to_cart");
    expect(clarity).toHaveBeenCalledWith("upgrade", "add_to_cart");
    expect(clarity).toHaveBeenCalledWith("set", "locale", "pt");
  });

  it("does not call window.clarity without analytics consent", async () => {
    const clarity = vi.fn();
    (window as ClarityWindow).clarity = clarity;

    const { clarityEvent, clarityTag, clarityUpgrade } = await loadClarity();
    clarityEvent("view_item");
    clarityUpgrade("begin_checkout");
    clarityTag("page_type", "product");

    expect(clarity).not.toHaveBeenCalled();
  });

  it("no-ops without throwing when window.clarity is missing", async () => {
    allowAnalytics();

    const { clarityEvent, clarityTag, clarityUpgrade } = await loadClarity();
    expect(() => {
      clarityEvent("shop_search");
      clarityUpgrade("add_to_cart");
      clarityTag("cart_has_items", "true");
    }).not.toThrow();
  });

  it("never forwards ecommerce metadata or PII fields through the clarity helpers", async () => {
    allowAnalytics();
    const clarity = vi.fn();
    (window as ClarityWindow).clarity = clarity;

    const { clarityEvent, clarityTag, clarityUpgrade } = await loadClarity();
    clarityEvent("begin_checkout");
    clarityUpgrade("begin_checkout");
    clarityTag("page_type", "cart");

    for (const call of clarity.mock.calls) {
      const serialized = JSON.stringify(call);
      expect(serialized).not.toMatch(/email|customerId|order|amount|ecommerce|value|price/i);
      expect(call).toHaveLength(call[0] === "set" ? 3 : 2);
    }
  });
});
