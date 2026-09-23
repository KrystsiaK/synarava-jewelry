import { expect, test } from "@playwright/test";

type CapturedEvent = {
  event: string;
  properties: Record<string, unknown>;
};

test.describe("Commerce analytics contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener("synarava:commerce-event", (event) => {
        const detail = (event as CustomEvent).detail;
        const captured = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]");
        captured.push(detail);
        sessionStorage.setItem("test:commerce-events", JSON.stringify(captured));
      });
    });
  });

  test("emits product view without a vendor SDK", async ({ page }) => {
    await page.goto("/shop");

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();

    await expect.poll(async () => page.evaluate(() => {
      const events = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]") as CapturedEvent[];
      return events.some((event) => event.event === "view_item");
    })).toBe(true);
  });
});
