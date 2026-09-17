import { expect, test } from "@playwright/test";

test("storefront loads and exposes primary navigation", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop" }).first()).toBeVisible();
});
