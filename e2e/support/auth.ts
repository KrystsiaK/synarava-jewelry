import type { Page } from "@playwright/test";

import { createPrivacyConsent, PRIVACY_CONSENT_COOKIE, serializePrivacyConsent } from "@/lib/privacy/consent";

import { adminCredentials } from "./env";

export { adminCredentials } from "./env";

/** Where the authenticated storage state produced by auth.setup.ts lives. */
export const ADMIN_STORAGE_STATE_PATH = "playwright/.auth/admin.json";

export function hasAdminCredentials(): boolean {
  return adminCredentials() !== null;
}

/**
 * `PrivacyConsentManager` is mounted in the root layout (`app/layout.tsx`),
 * so its cookie-consent banner also covers `/admin/**` — a customer-facing
 * banner shown to internal staff, which is arguably its own bug. Admin specs
 * aren't testing that banner, so pre-accept consent via cookie the same way
 * a real admin would after their first visit, rather than fighting it with
 * click retries on every test that navigates.
 */
export async function suppressPrivacyBanner(page: Page): Promise<void> {
  const consent = serializePrivacyConsent(
    createPrivacyConsent({ preferences: true, analytics: false, marketing: false }),
  );
  await page.context().addCookies([
    { name: PRIVACY_CONSENT_COOKIE, value: consent, url: "http://localhost:3000" },
  ]);
}

/**
 * Drives the real login form. Used both by the auth setup project (which
 * saves the resulting session as storageState for every other admin spec)
 * and by admin-auth.spec.ts, which tests the login/logout mechanics
 * themselves and therefore cannot rely on a pre-authenticated session.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  const credentials = adminCredentials();
  if (!credentials) {
    throw new Error(
      "loginAsAdmin() called without ADMIN_USERNAME/ADMIN_EMAIL + ADMIN_PASSWORD configured.",
    );
  }

  await suppressPrivacyBanner(page);
  await page.goto("/admin/login");
  await page.getByLabel("Username or email").fill(credentials.username);
  await page.locator('input[name="password"]').fill(credentials.password);
  await page.getByRole("button", { name: "Enter admin" }).click();
  await page.waitForURL(/\/admin$/);
}
