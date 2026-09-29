import { expect, test } from "@playwright/test";

/**
 * Live response headers — complements `__tests__/proxy.test.ts` (unit on proxy())
 * and `admin-auth.spec.ts` (guest redirect). Catches a miswired middleware/proxy
 * that ships HTML without the CSP built in proxy.ts.
 */
test.describe("Security response headers", () => {
  for (const path of ["/en", "/admin/login"] as const) {
    test(`${path} sends CSP with nonce + strict-dynamic`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBeLessThan(400);

      const csp = response.headers()["content-security-policy"];
      expect(csp, "Content-Security-Policy missing").toBeTruthy();
      expect(csp).toMatch(/script-src[^;]*'nonce-[A-Za-z0-9+/=_-]+'/);
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'none'");
    });
  }

  test("storefront also advertises CSP reporting", async ({ request }) => {
    const response = await request.get("/en");
    const csp = response.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("report-uri /api/csp-report");
    expect(response.headers()["reporting-endpoints"]).toContain("csp-endpoint");
  });
});
