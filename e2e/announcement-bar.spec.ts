import { expect, test } from "@playwright/test";

/**
 * CI seed enables announcement-bar-v1 with a threshold amount.
 * Spec requires the banner present — no “or absent” branch.
 * Human: wire `e2e/announcement-bar.spec.ts` into the Playwright CI step
 * (bots must not edit `.github/workflows/ci.yml`).
 */
test.describe("announcement bar", () => {
  for (const path of ["/en", "/en/shop", "/en/cart"] as const) {
    test(`visible on ${path}`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      const bar = page.locator(".announcement-bar");
      await expect(bar).toHaveCount(1);
      await expect(bar).toBeVisible();
      const height = await bar.evaluate((el) => getComputedStyle(el).height);
      expect(height).toBe("36px");
      await expect(bar).not.toHaveAttribute("aria-label");
      await expect(bar.locator(".announcement-bar__static")).toHaveCount(1);
      await expect(bar.locator(".announcement-bar__marquee")).toHaveAttribute("aria-hidden", "true");
    });
  }

  test("prefers-reduced-motion keeps static text without marquee animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    const bar = page.locator(".announcement-bar");
    await expect(bar).toHaveCount(1);
    await expect(bar.locator(".announcement-bar__static")).toBeVisible();
    await expect(bar.locator(".announcement-bar__marquee")).toBeHidden();
    const animation = await bar.locator(".announcement-bar__cycle").evaluate((el) => {
      return getComputedStyle(el).animationName;
    });
    expect(animation === "none" || animation === "").toBeTruthy();
  });

  test("marquee cycle covers at least two viewport widths at 1440 and 375", async ({ page }) => {
    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);
      const bar = page.locator(".announcement-bar");
      await expect(bar).toBeVisible();
      const metrics = await bar.evaluate((el) => {
        const cycle = el.querySelector(".announcement-bar__cycle") as HTMLElement | null;
        if (!cycle) return null;
        const style = getComputedStyle(cycle);
        return {
          cycleWidth: cycle.getBoundingClientRect().width,
          viewport: window.innerWidth,
          hasGap: style.columnGap !== "normal" && style.columnGap !== "0px"
            ? style.columnGap
            : style.gap !== "normal" && style.gap !== "0px"
              ? style.gap
              : "0px",
        };
      });
      expect(metrics).not.toBeNull();
      expect(metrics!.hasGap).toBe("0px");
      expect(metrics!.cycleWidth).toBeGreaterThanOrEqual(metrics!.viewport * 2);
    }
  });
});
