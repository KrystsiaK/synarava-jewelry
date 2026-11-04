import { describe, expect, it } from "vitest";

import { ADMIN_SESSION_COOKIE } from "@/lib/auth/admin-session";
import { resolveOptionalAnalyticsIds } from "../optional-analytics-ids";

const IDS = {
  gtmId: "GTM-TEST",
  metaPixelId: "META-TEST",
  claritySiteId: "CLARITY-TEST",
} as const;

describe("resolveOptionalAnalyticsIds", () => {
  it("keeps the cookie name from lib/auth (no duplicated string)", () => {
    expect(ADMIN_SESSION_COOKIE).toBe("synarava-admin-session");
  });

  it("admin-cookie on a normal page → ids undefined", () => {
    expect(
      resolveOptionalAnalyticsIds({
        optionalAnalyticsEnabled: true,
        pathname: "/en/shop",
        adminSessionCookie: "session.token.signature",
        ...IDS,
      }),
    ).toEqual({
      gtmId: undefined,
      metaPixelId: undefined,
      claritySiteId: undefined,
    });
  });

  it("no cookie on normal page with optionalAnalyticsEnabled → ids set", () => {
    expect(
      resolveOptionalAnalyticsIds({
        optionalAnalyticsEnabled: true,
        pathname: "/en/shop",
        adminSessionCookie: undefined,
        ...IDS,
      }),
    ).toEqual(IDS);
  });

  it("/admin path without cookie → ids undefined", () => {
    expect(
      resolveOptionalAnalyticsIds({
        optionalAnalyticsEnabled: true,
        pathname: "/admin/login",
        adminSessionCookie: undefined,
        ...IDS,
      }),
    ).toEqual({
      gtmId: undefined,
      metaPixelId: undefined,
      claritySiteId: undefined,
    });
  });

  it("treats nested /admin routes like /admin/login", () => {
    expect(
      resolveOptionalAnalyticsIds({
        optionalAnalyticsEnabled: true,
        pathname: "/admin/products",
        adminSessionCookie: undefined,
        ...IDS,
      }).gtmId,
    ).toBeUndefined();
  });

  it("stays off when optional analytics are disabled even on the storefront", () => {
    expect(
      resolveOptionalAnalyticsIds({
        optionalAnalyticsEnabled: false,
        pathname: "/en",
        adminSessionCookie: undefined,
        ...IDS,
      }),
    ).toEqual({
      gtmId: undefined,
      metaPixelId: undefined,
      claritySiteId: undefined,
    });
  });
});
