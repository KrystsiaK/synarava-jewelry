import { expect, test } from "@playwright/test";

test.describe("EN/PT route matrix", () => {
  test("renders Portuguese service routes without an English content flash", async ({ context, page }) => {
    await context.addCookies([{
      name: "synarava-locale",
      value: "pt",
      domain: "localhost",
      path: "/",
    }]);

    await page.goto("/shipping");
    await expect(page.locator("html")).toHaveAttribute("lang", "pt");
    await expect(page.getByRole("heading", { level: 1, name: "Do estúdio até si" })).toBeVisible();
    await expect(page.getByText("Delivery options", { exact: true })).toHaveCount(0);

    await page.goto("/faq");
    await expect(page.getByRole("heading", { level: 1, name: "Antes de escolher" })).toBeVisible();
    await expect(page.getByText("Tudo é produzido pela Synarava?", { exact: true })).toBeVisible();
  });

  test("keeps English as the explicit default", async ({ context, page }) => {
    await context.addCookies([{
      name: "synarava-locale",
      value: "en",
      domain: "localhost",
      path: "/",
    }]);

    await page.goto("/returns");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("heading", { level: 1, name: "A considered return" })).toBeVisible();
  });
});
