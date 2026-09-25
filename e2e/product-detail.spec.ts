import { expect, test } from "@playwright/test";

test.describe("Product detail", () => {
  test("keeps product context and product information beside the purchase action", async ({ page }) => {
    await page.goto("/shop");

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible();

    await expect(page.getByRole("navigation", { name: "Purchase information" })).toHaveCount(0);
    const productInformation = page.locator('[data-component="ProductSpecifications"]');
    await expect(productInformation).toBeVisible();
    await expect(productInformation.getByText("Product information")).toBeVisible();
    await expect(productInformation.getByRole("heading", { name: "Details that matter" })).toBeVisible();
  });

  test("keeps the purchase header within a narrow mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();

    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
