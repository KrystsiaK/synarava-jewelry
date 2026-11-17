import { expect, test } from "@playwright/test";

/**
 * Visibility requires announcement-bar-v1 enabled + adopted threshold in DB
 * (CI seed / local seed). When off, the suite still asserts no empty shell.
 */
test.describe("announcement bar", () => {
  for (const path of ["/en", "/en/shop", "/en/cart"] as const) {
    test(`visible or absent (never empty) on ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const bars = page.locator(".announcement-bar");
      const count = await bars.count();
      if (count === 0) {
        await expect(bars).toHaveCount(0);
        return;
      }
      await expect(bars.first()).toBeVisible();
      const height = await bars.first().evaluate((el) => getComputedStyle(el).height);
      expect(height).toBe("36px");
      await expect(bars.first()).toHaveAttribute("role", "region");
    });
  }

  test("prefers-reduced-motion keeps static text without marquee animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    const bar = page.locator(".announcement-bar");
    if (await bar.count() === 0) {
      test.skip(true, "Announcement bar off in this environment — no empty shell");
      return;
    }
    await expect(bar.locator(".announcement-bar__static")).toBeVisible();
    await expect(bar.locator(".announcement-bar__marquee")).toBeHidden();
    const animation = await bar.locator(".announcement-bar__cycle").evaluate((el) => {
      return getComputedStyle(el).animationName;
    });
    expect(animation === "none" || animation === "").toBeTruthy();
  });
});
