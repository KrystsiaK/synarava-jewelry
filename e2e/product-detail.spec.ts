import { expect, test } from "@playwright/test";

test.describe("Product detail", () => {
  test("keeps product context and service guidance beside the purchase action", async ({ page }) => {
    await page.goto("/shop");

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();

    const breadcrumb = page.getByRole("navigation", { name: "Breadcrumb" });
    await expect(breadcrumb).toBeVisible();
    await expect(breadcrumb.getByRole("link", { name: "Shop" })).toHaveAttribute("href", "/shop");
    await expect(breadcrumb.locator('[aria-current="page"]')).toBeVisible();

    const purchaseInformation = page.getByRole("navigation", { name: "Purchase information" });
    await expect(purchaseInformation.getByRole("link", { name: /Delivery/ })).toHaveAttribute("href", "/shipping");
    await expect(purchaseInformation.getByRole("link", { name: /Returns/ })).toHaveAttribute("href", "/returns");
    await expect(purchaseInformation.getByRole("link", { name: /Care & safety/ })).toHaveAttribute("href", "/care");
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
