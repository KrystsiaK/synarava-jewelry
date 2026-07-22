import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

function readEnvValue(key: string) {
  const sources = [".env.local", ".env"];

  for (const source of sources) {
    let contents = "";

    try {
      contents = readFileSync(source, "utf8");
    } catch {
      continue;
    }

    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!match || match[1] !== key) continue;

      return match[2].trim().replace(/^["']|["']$/g, "");
    }
  }

  return "";
}

test.describe("Admin auth", () => {
  test.describe.configure({ mode: "serial" });

  test("redirects guests from /admin to /admin/login", async ({ page }) => {
    await page.goto("/admin");

    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
    await expect(page.getByRole("heading", { name: "Studio credentials" })).toBeVisible();
  });

  test("allows configured admin credentials into the admin studio", async ({ page }) => {
    const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
    const password = readEnvValue("ADMIN_PASSWORD");

    test.skip(!username || !password, "Local legacy admin credentials are not configured.");

    await page.goto("/admin/login");
    await page.getByLabel("Username or email").fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Enter admin" }).click();

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByText("Admin studio")).toBeVisible();
  });

  test("logout clears admin access", async ({ page }) => {
    const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
    const password = readEnvValue("ADMIN_PASSWORD");

    test.skip(!username || !password, "Local legacy admin credentials are not configured.");

    await page.goto("/admin/login");
    await page.getByLabel("Username or email").fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Enter admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole("button", { name: "Log out" }).first().click();
    await expect(page).toHaveURL(/\/admin\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login\?redirectTo=%2Fadmin/);
  });

  test("keeps sidebar footer reachable while page scrolls", async ({ page }) => {
    const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
    const password = readEnvValue("ADMIN_PASSWORD");

    test.skip(!username || !password, "Local legacy admin credentials are not configured.");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/login");
    await page.getByLabel("Username or email").fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Enter admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const footer = page.locator(".admin-sidebar-footer");
    await expect(footer).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    const afterFooter = await footer.boundingBox();

    expect(afterFooter).not.toBeNull();

    const afterFooterBottom = afterFooter!.y + afterFooter!.height;

    expect(afterFooter!.y).toBeGreaterThanOrEqual(0);
    expect(afterFooterBottom).toBeLessThanOrEqual(900);
  });

  test("keeps admin topbar fixed while page scrolls", async ({ page }) => {
    const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
    const password = readEnvValue("ADMIN_PASSWORD");

    test.skip(!username || !password, "Local legacy admin credentials are not configured.");

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/login");
    await page.getByLabel("Username or email").fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Enter admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    const topbar = page.locator(".adm-topbar");
    await expect(topbar).toBeVisible();
    const before = await topbar.boundingBox();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    const after = await topbar.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.round(before!.y)).toBe(0);
    expect(Math.round(after!.y)).toBe(0);
  });

  test("does not create horizontal overflow on the products list", async ({ page }) => {
    const username = readEnvValue("ADMIN_USERNAME") || readEnvValue("ADMIN_EMAIL");
    const password = readEnvValue("ADMIN_PASSWORD");

    test.skip(!username || !password, "Local legacy admin credentials are not configured.");

    await page.setViewportSize({ width: 778, height: 881 });
    await page.goto("/admin/login");
    await page.getByLabel("Username or email").fill(username);
    await page.locator('input[name="password"]').fill(password);
    await page.getByRole("button", { name: "Enter admin" }).click();
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products list" })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
  });
});
