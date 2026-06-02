import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
  });

  test("shows SYNARAVA wordmark in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SYNARAVA").first()).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Shop" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Collections" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "About" }).first()).toBeVisible();
  });

  test("footer is present", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(page.locator("footer")).toBeVisible();
  });

  test("cart link is present in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Cart/ })).toBeVisible();
  });
});
