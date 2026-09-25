import { expect, test } from "@playwright/test";

import { adminCredentials, hasAdminCredentials, loginAsAdmin, suppressPrivacyBanner } from "./support/auth";

test.describe("Admin auth", () => {
  test.describe.configure({ mode: "serial" });

  test("redirects guests from /admin to /admin/login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Admin credentials" })).toBeVisible();
  });

  test("returns to the intended nested page after login", async ({ page }) => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");

    await suppressPrivacyBanner(page);
    await page.goto("/admin/products");
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin%2Fproducts/);

    const credentials = adminCredentials();
    if (!credentials) throw new Error("missing admin credentials");
    await page.getByLabel("Username or email").fill(credentials.username);
    await page.locator('input[name="password"]').fill(credentials.password);
    await page.getByRole("button", { name: "Enter admin" }).click();

    await expect(page).toHaveURL(/\/admin\/products$/);
    await expect(page.getByText("Admin console")).toBeVisible();
  });

  test("allows configured admin credentials into the admin console", async ({ page }) => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");

    await loginAsAdmin(page);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Admin console")).toBeVisible();
  });

  test("logout clears admin access", async ({ page }) => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");

    await loginAsAdmin(page);

    await page.getByRole("button", { name: "Log out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
  });
});
