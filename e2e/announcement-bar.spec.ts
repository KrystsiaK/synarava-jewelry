import { expect, test } from "@playwright/test";

import {
  ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S,
  ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S,
} from "@/lib/content/announcement-bar-display";

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
      const metrics = await bar.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          height: parseFloat(style.height),
          fontSize: parseFloat(style.fontSize),
          fontWeight: style.fontWeight,
        };
      });
      expect(metrics.fontSize).toBeGreaterThanOrEqual(13);
      expect(metrics.height).toBeCloseTo(metrics.fontSize * 2.75, 0);
      expect(Number.parseInt(metrics.fontWeight, 10)).toBeGreaterThanOrEqual(500);
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

  test("marquee speed stays within 40–50 px/s from duration and cycle width", async ({ page }) => {
    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);
      const bar = page.locator(".announcement-bar");
      await expect(bar).toBeVisible();
      await expect
        .poll(async () => {
          return bar.evaluate((el) => {
            const duration = getComputedStyle(el).getPropertyValue("--announcement-marquee-duration").trim();
            return duration.length > 0 && duration !== "60s";
          });
        })
        .toBe(true);

      const speed = await bar.evaluate((el) => {
        const cycle = el.querySelector(".announcement-bar__cycle") as HTMLElement | null;
        if (!cycle) return null;
        const cycleWidth = cycle.getBoundingClientRect().width;
        const durationSec = Number.parseFloat(getComputedStyle(cycle).animationDuration);
        if (!Number.isFinite(durationSec) || durationSec <= 0) return null;
        return (cycleWidth / 2) / durationSec;
      });
      expect(speed).not.toBeNull();
      expect(speed!).toBeGreaterThanOrEqual(ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S);
      expect(speed!).toBeLessThanOrEqual(ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S);
    }
  });

  test("header and banner do not overlap on scroll (desktop and mobile)", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ] as const) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);

      const bar = page.locator(".announcement-bar");
      const header = page.locator("header.artifact-nav");
      await expect(bar).toBeVisible();
      await expect(header).toBeVisible();

      await page.evaluate(() => window.scrollTo(0, 240));
      await expect(bar).toHaveAttribute("data-hidden", "true");
      await expect(header).toHaveAttribute("data-scrolled", "true");

      const overlap = await page.evaluate(() => {
        const banner = document.querySelector(".announcement-bar");
        const nav = document.querySelector("header.artifact-nav");
        if (!banner || !nav) return { error: "missing" as const };
        const a = banner.getBoundingClientRect();
        const b = nav.getBoundingClientRect();
        const intersects =
          a.height > 0 &&
          b.height > 0 &&
          a.left < b.right &&
          a.right > b.left &&
          a.top < b.bottom &&
          a.bottom > b.top;
        return {
          intersects,
          bannerHeight: a.height,
          bannerBottom: a.bottom,
          headerTop: b.top,
        };
      });
      expect(overlap).not.toHaveProperty("error");
      expect(overlap.intersects).toBe(false);
      expect(overlap.bannerHeight).toBe(0);

      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(bar).toHaveAttribute("data-hidden", "false");
      await expect(bar).toBeVisible();
    }
  });
});
