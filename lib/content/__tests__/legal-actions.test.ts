import { describe, expect, it } from "vitest";

import {
  isLegalActionHref,
  parseLegalActionHref,
  resolveLegalActionPath,
} from "@/lib/content/legal-actions";

describe("isLegalActionHref", () => {
  it("recognizes the action: scheme regardless of the identifier", () => {
    expect(isLegalActionHref("action:cookie-settings")).toBe(true);
    expect(isLegalActionHref("action:anything-else")).toBe(true);
  });

  it("rejects other href schemes", () => {
    expect(isLegalActionHref("https://example.com")).toBe(false);
    expect(isLegalActionHref("mailto:foo@example.com")).toBe(false);
    expect(isLegalActionHref("#cookies")).toBe(false);
    expect(isLegalActionHref("/shipping")).toBe(false);
  });
});

describe("parseLegalActionHref", () => {
  it("returns the id for an allowlisted action", () => {
    expect(parseLegalActionHref("action:cookie-settings")).toBe("cookie-settings");
  });

  it("fails closed for an unrecognized action id, not a crash or passthrough", () => {
    expect(parseLegalActionHref("action:anything-else")).toBeNull();
    expect(parseLegalActionHref("action:")).toBeNull();
  });

  it("returns null for a non-action href", () => {
    expect(parseLegalActionHref("https://example.com")).toBeNull();
  });
});

describe("resolveLegalActionPath", () => {
  it("maps allowlisted actions to storefront paths", () => {
    expect(resolveLegalActionPath("action:cookie-settings")).toBe("/cookie-settings");
  });

  it("returns null for unknown or non-action hrefs", () => {
    expect(resolveLegalActionPath("action:evil")).toBeNull();
    expect(resolveLegalActionPath("/cookie-settings")).toBeNull();
  });
});
