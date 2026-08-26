import { expect, test } from "@playwright/test";

test.describe("Catalog resilience", () => {
  test("offers a clear recovery path when filters return no products", async ({ page }) => {
    await page.goto("/shop?q=no-product-can-match-this-query");

    await expect(page.getByRole("heading", { name: "No products matched." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Show all products" })).toHaveAttribute("href", "/shop");
  });

  test("keeps catalog and PDP usable when product media fails", async ({ page }) => {
    await page.route("**/*", (route) => (
      route.request().resourceType() === "image" ? route.abort() : route.continue()
    ));
    await page.goto("/shop");

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await expect(productLink.getByRole("img", { name: "Image unavailable" })).toBeVisible();
    await productLink.click();

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("img", { name: "Image unavailable" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Add to cart|Currently unavailable/ })).toBeVisible();
  });

  test("renders essential controls before deliberately slow media completes", async ({ page }) => {
    await page.route("**/*", async (route) => {
      if (route.request().resourceType() !== "image") {
        await route.continue();
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1_500));
      await route.abort();
    });

    await page.goto("/shop", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Shop by department" })).toBeVisible();
    await expect(page.getByRole("searchbox", { name: "Search products" })).toBeVisible();
  });

  test("contains unusually long catalog copy on a narrow viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");

    const title = page.locator('a[href^="/products/"] h3').first();
    await expect(title).toBeVisible();
    await title.evaluate((element) => {
      element.textContent = "A deliberately long product title with uninterrupted multilingual catalogue context";
    });

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(hasHorizontalOverflow).toBe(false);
  });
});
