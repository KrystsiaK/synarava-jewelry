import { test, expect } from "@playwright/test";

test.describe("Navigation", () => {
  test("navigates to /about from home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "About" }).first().click();
    await expect(page).toHaveURL(/\/about/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("navigates to /collections from home", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Collections" }).first().click();
    await expect(page).toHaveURL(/\/collections/);
  });

  test("navigates to /cart", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Cart/ }).click();
    await expect(page).toHaveURL(/\/cart/);
  });

  test("mobile menu opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    const menuBtn = page.getByRole("button", { name: "Open navigation menu" });
    await expect(menuBtn).toBeVisible();
    await menuBtn.click();
    await expect(page.getByRole("button", { name: "Close navigation menu" })).toBeVisible();
    await page.getByRole("button", { name: "Close navigation menu" }).click();
    await expect(page.getByRole("button", { name: "Open navigation menu" })).toBeVisible();
  });

  test("switches to the compact header before desktop controls crowd", async ({ page }) => {
    await page.setViewportSize({ width: 1199, height: 900 });
    await page.goto("/");

    const banner = page.getByRole("banner");
    const menuButton = banner.getByRole("button", { name: "Open navigation menu" });
    await expect(menuButton).toBeVisible();
    await expect(banner.getByRole("navigation")).toBeHidden();
    await expect(banner.getByRole("group", { name: "Theme switcher" })).toBeHidden();

    await menuButton.click();
    const drawer = page.locator(".site-nav-drawer");
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("group", { name: "Theme switcher" })).toBeVisible();

    await page.setViewportSize({ width: 1200, height: 900 });
    await expect(menuButton).toBeHidden();
    await expect(drawer).toBeHidden();
    await expect(banner.getByRole("navigation")).toBeVisible();
    await expect(banner.getByRole("group", { name: "Theme switcher" })).toBeVisible();
  });

  test("mobile language menu stays inside the viewport and only offers English and Portuguese", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");
    await page.getByRole("button", { name: "Open navigation menu" }).click();

    const drawer = page.locator(".site-nav-drawer");
    await drawer.getByRole("button", { name: "Select language" }).click();

    const languageMenu = page.getByRole("listbox", { name: "Select language" });
    await expect(languageMenu).toBeVisible();
    await expect(languageMenu).toHaveAttribute("data-side", "top");
    await expect(languageMenu.getByRole("option")).toHaveCount(2);
    await expect(languageMenu.getByRole("option", { name: "English" })).toBeVisible();
    await expect(languageMenu.getByRole("option", { name: "Português" })).toBeVisible();

    const bounds = await languageMenu.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(375);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(812);
  });

  test("theme toggle is present on editorial pages", async ({ page }) => {
    await page.goto("/about");
    await expect(page.getByRole("banner").getByLabel("Theme switcher")).toBeVisible();
  });

  test("theme selection applies globally and survives reload", async ({ page }) => {
    await page.goto("/shop");
    const switcher = page.getByRole("banner").getByRole("group", { name: "Theme switcher" });

    await switcher.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await switcher.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  });

  test("/about/manifesto loads", async ({ page }) => {
    await page.goto("/about/manifesto");
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("h1")).toBeVisible();
  });
});
