import { expect, test } from "@playwright/test";

import { hasAdminCredentials, loginAsAdmin } from "./support/auth";

test.describe("Admin auth", () => {
  test.describe.configure({ mode: "serial" });

  test("redirects guests from /admin to /admin/login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Studio credentials" })).toBeVisible();
  });

  test("allows configured admin credentials into the admin studio", async ({ page }) => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");

    await loginAsAdmin(page);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Admin studio")).toBeVisible();
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
