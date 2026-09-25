import { describe, expect, it } from "vitest";

import {
  ADMIN_RETURN_TO_COOKIE,
  getSafeAdminRedirect,
} from "@/lib/auth/admin-return-path";

describe("getSafeAdminRedirect", () => {
  it("keeps admin paths and query strings", () => {
    expect(getSafeAdminRedirect("/admin/products?tab=drafts")).toBe(
      "/admin/products?tab=drafts",
    );
  });

  it("rejects login loops and non-admin paths", () => {
    expect(getSafeAdminRedirect("/admin/login?redirectTo=/admin/products")).toBe("/admin");
    expect(getSafeAdminRedirect("/administrator")).toBe("/admin");
    expect(getSafeAdminRedirect("/admin-login")).toBe("/admin");
  });

  it("rejects open redirects", () => {
    expect(getSafeAdminRedirect("https://evil.example/admin")).toBe("/admin");
    expect(getSafeAdminRedirect("//evil.example/admin")).toBe("/admin");
  });
});

describe("admin return-to cookie name", () => {
  it("stays scoped to the admin cookie family", () => {
    expect(ADMIN_RETURN_TO_COOKIE).toBe("synarava-admin-return-to");
  });
});
