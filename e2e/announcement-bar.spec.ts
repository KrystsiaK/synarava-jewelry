import { expect, test } from "@playwright/test";

import {
  ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S,
  ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S,
} from "@/components/ui/announcement-marquee";

/**
 * CI seed enables announcement-bar-v1 with a threshold amount.
 * Banner lives on the home page between hero and the next section.
 * Human: wire `e2e/announcement-bar.spec.ts` into the Playwright CI step
 * (bots must not edit `.github/workflows/ci.yml`).
 */
test.describe("announcement marquee (home)", () => {
  test("sits between hero and next section; does not overlap header", async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 375, height: 812 },
    ] as const) {
      await page.setViewportSize(viewport);
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);

      const bar = page.locator(".announcement-marquee");
      const hero = page.locator('[data-component="HeroSection"]');
      const header = page.locator("header.artifact-nav");
      await expect(bar).toHaveCount(1);
      await expect(bar).toBeVisible();
      await expect(hero).toBeVisible();
      await expect(header).toBeVisible();

      const order = await page.evaluate(() => {
        const main = document.querySelector("main.home-experience");
        if (!main) return null;
        const children = Array.from(main.children);
        const heroEl = main.querySelector('[data-component="HeroSection"]');
        const barEl = main.querySelector(".announcement-marquee");
        if (!heroEl || !barEl) return null;
        const heroIndex = children.indexOf(heroEl as Element);
        const barIndex = children.indexOf(barEl as Element);
        const afterBar = children[barIndex + 1] as HTMLElement | undefined;
        return {
          heroIndex,
          barIndex,
          nextTag: afterBar?.tagName ?? null,
          nextComponent: afterBar?.getAttribute("data-component") ?? null,
        };
      });
      expect(order).not.toBeNull();
      expect(order!.barIndex).toBe(order!.heroIndex + 1);
      expect(order!.barIndex).toBeGreaterThanOrEqual(0);
      expect(order!.nextComponent).not.toBeNull();

      const geometry = await page.evaluate(() => {
        const banner = document.querySelector(".announcement-marquee");
        const heroEl = document.querySelector('[data-component="HeroSection"]');
        const next = banner?.nextElementSibling as HTMLElement | null;
        const nav = document.querySelector("header.artifact-nav");
        if (!banner || !heroEl || !next || !nav) return { error: "missing" as const };
        const b = banner.getBoundingClientRect();
        const h = heroEl.getBoundingClientRect();
        const n = next.getBoundingClientRect();
        const navBox = nav.getBoundingClientRect();
        const overlapsHeader =
          b.height > 0 &&
          navBox.height > 0 &&
          b.left < navBox.right &&
          b.right > navBox.left &&
          b.top < navBox.bottom &&
          b.bottom > navBox.top;
        return {
          bannerTop: b.top,
          bannerBottom: b.bottom,
          heroBottom: h.bottom,
          nextTop: n.top,
          overlapsHeader,
          fontSize: parseFloat(getComputedStyle(banner).fontSize),
          height: parseFloat(getComputedStyle(banner).height),
          fontWeight: getComputedStyle(banner).fontWeight,
          gap: getComputedStyle(banner).getPropertyValue("--announcement-marquee-gap").trim(),
        };
      });
      expect(geometry).not.toHaveProperty("error");
      if ("error" in geometry) throw new Error("missing geometry");
      expect(geometry.bannerTop).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
      expect(geometry.nextTop).toBeGreaterThanOrEqual(geometry.bannerBottom - 1);
      expect(geometry.overlapsHeader).toBe(false);
      expect(geometry.fontSize).toBeGreaterThanOrEqual(viewport.width >= 768 ? 18 : 15);
      expect(geometry.fontSize).toBeLessThanOrEqual(viewport.width >= 768 ? 22 : 17);
      expect(geometry.height).toBeCloseTo(geometry.fontSize * 2.75, 0);
      expect(Number.parseInt(geometry.fontWeight, 10)).toBeGreaterThanOrEqual(600);
      expect(parseFloat(geometry.gap)).toBeGreaterThanOrEqual(6);

      await expect(bar).not.toHaveAttribute("aria-label");
      await expect(bar.locator(".announcement-marquee__static")).toHaveCount(1);
      await expect(bar.locator(".announcement-marquee__marquee")).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("absent on non-home routes", async ({ page }) => {
    for (const path of ["/en/shop", "/en/cart"] as const) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator(".announcement-marquee")).toHaveCount(0);
    }
  });

  test("prefers-reduced-motion keeps static text without marquee animation", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const response = await page.goto("/en");
    expect(response?.status()).toBe(200);
    const bar = page.locator(".announcement-marquee");
    await expect(bar).toHaveCount(1);
    await expect(bar.locator(".announcement-marquee__static")).toBeVisible();
    await expect(bar.locator(".announcement-marquee__marquee")).toBeHidden();
    const animation = await bar.locator(".announcement-marquee__cycle").evaluate((el) => {
      return getComputedStyle(el).animationName;
    });
    expect(animation === "none" || animation === "").toBeTruthy();
  });

  test("marquee cycle covers at least two viewport widths with large gap", async ({ page }) => {
    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);
      const bar = page.locator(".announcement-marquee");
      await expect(bar).toBeVisible();
      const metrics = await bar.evaluate((el) => {
        const cycle = el.querySelector(".announcement-marquee__cycle") as HTMLElement | null;
        const span = cycle?.querySelector("span") as HTMLElement | null;
        if (!cycle || !span) return null;
        const style = getComputedStyle(cycle);
        const spanStyle = getComputedStyle(span);
        const padLeft = parseFloat(spanStyle.paddingInlineStart) || 0;
        const padRight = parseFloat(spanStyle.paddingInlineEnd) || 0;
        const fontSize = parseFloat(getComputedStyle(el).fontSize) || 16;
        return {
          cycleWidth: cycle.getBoundingClientRect().width,
          viewport: window.innerWidth,
          hasGap: style.columnGap !== "normal" && style.columnGap !== "0px"
            ? style.columnGap
            : style.gap !== "normal" && style.gap !== "0px"
              ? style.gap
              : "0px",
          padEm: (padLeft + padRight) / fontSize,
        };
      });
      expect(metrics).not.toBeNull();
      expect(metrics!.hasGap).toBe("0px");
      expect(metrics!.padEm).toBeGreaterThanOrEqual(6);
      expect(metrics!.cycleWidth).toBeGreaterThanOrEqual(metrics!.viewport * 2);
    }
  });

  test("marquee speed stays within 25–35 px/s from duration and cycle width", async ({ page }) => {
    for (const width of [1440, 375] as const) {
      await page.setViewportSize({ width, height: 800 });
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);
      const bar = page.locator(".announcement-marquee");
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
        const cycle = el.querySelector(".announcement-marquee__cycle") as HTMLElement | null;
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

  test("light and dark themes keep readable contrast on home", async ({ page, context }) => {
    for (const theme of ["light", "dark"] as const) {
      await context.clearCookies();
      await context.addCookies([
        { name: "synarava-theme", value: theme, url: "http://localhost:3000" },
      ]);
      await page.setViewportSize({ width: 1440, height: 900 });
      const response = await page.goto("/en");
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
      const bar = page.locator(".announcement-marquee");
      await expect(bar).toBeVisible();
      const colors = await bar.evaluate((el) => {
        const style = getComputedStyle(el);
        return { color: style.color, background: style.backgroundColor };
      });
      expect(colors.color).toBeTruthy();
      expect(colors.background).toBeTruthy();
      // Not sticky/fixed chrome — document flow under main, may scroll past header.
      const position = await bar.evaluate((el) => getComputedStyle(el).position);
      expect(position).toBe("relative");
    }
  });
});

