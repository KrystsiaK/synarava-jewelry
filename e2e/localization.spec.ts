import { expect, test } from "@playwright/test";

test.describe("EN/PT/RU route matrix", () => {
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

  // Russian has no admin-entered translations yet (Task U10 is content work,
  // not code) — this is the "simple (ru)" case the release gate cares
  // about: a registered locale with zero reviewed copy must still resolve
  // as its own locale (not silently collapse to English) and render the
  // honest English fallback everywhere, never a blank or broken page.
  test("resolves Russian as its own locale and falls back to English content cleanly", async ({ context, page }) => {
    await context.addCookies([{
      name: "synarava-locale",
      value: "ru",
      domain: "localhost",
      path: "/",
    }]);

    await page.goto("/shipping");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("heading", { level: 1, name: "From the studio to you" })).toBeVisible();

    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "ru");
    await expect(page.getByRole("button", { name: "Select language" })).toBeVisible();
  });
});
