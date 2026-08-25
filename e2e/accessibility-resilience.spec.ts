import { expect, test } from "@playwright/test";

test.describe("Accessibility and resilience", () => {
  test("skip link moves keyboard focus to the main content", async ({ page }) => {
    await page.goto("/shop");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("mobile filter dialog isolates the background and restores trigger focus", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shop");

    const trigger = page.getByRole("button", { name: /^Filters/ });
    await trigger.click();

    await expect(page.getByRole("dialog", { name: "Filter products" })).toBeVisible();
    await expect(page.locator("#main-content")).toHaveAttribute("inert", "");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filter products" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("reduced motion disables smooth scrolling and long CSS transitions", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/shop");

    const motionPolicy = await page.evaluate(() => ({
      scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
      transitionDuration: getComputedStyle(document.querySelector("header")!).transitionDuration,
    }));

    expect(motionPolicy.scrollBehavior).toBe("auto");
    expect(Number.parseFloat(motionPolicy.transitionDuration)).toBeLessThanOrEqual(0.001);
  });

  test("core shop controls remain usable at 200% text size", async ({ page }) => {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/shop");
    await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });

    await expect(page.getByRole("button", { name: /^Filters/ })).toBeVisible();
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(horizontalOverflow).toBe(false);
  });
});
