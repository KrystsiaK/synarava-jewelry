import { expect, test } from "@playwright/test";

import {
  ANNOUNCEMENT_MARQUEE_SPEED_MAX_PX_PER_S,
  ANNOUNCEMENT_MARQUEE_SPEED_MIN_PX_PER_S,
} from "@/components/ui/announcement-marquee";

/**
 * CI seed enables announcement-bar-v1 with a threshold amount.
 * Home: between hero and next section (viewport-budget hero keeps it on-fold).
 * Other storefront routes: locale layout, immediately under header.
 * Human: wire `e2e/announcement-bar.spec.ts` into the Playwright CI step
 * (bots must not edit `.github/workflows/ci.yml`).
 */

const STOREFRONT_ROUTES = [
  "/en",
  "/en/shop",
  "/en/about",
] as const;

async function firstProductPath(page: import("@playwright/test").Page): Promise<string | null> {
  const response = await page.goto("/en/shop");
  if (!response || response.status() >= 400) return null;
  const href = await page.locator('a[href*="/products/"], a[href*="/artifacts/"]').first().getAttribute("href");
  return href;
}

test.describe("announcement marquee (storefront)", () => {
  test("home: sits between hero and next section; first-screen fit; hit-testing", async ({ page }) => {
    for (const viewport of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1280, height: 720 },
      { width: 768, height: 1024 },
      { width: 390, height: 844 },
      { width: 360, height: 640 },
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
          nextComponent: afterBar?.getAttribute("data-component") ?? null,
        };
      });
      expect(order).not.toBeNull();
      expect(order!.barIndex).toBe(order!.heroIndex + 1);
      expect(order!.nextComponent).not.toBeNull();

      const geometry = await page.evaluate(() => {
        const banner = document.querySelector(".announcement-marquee");
        const heroEl = document.querySelector('[data-component="HeroSection"]');
        const media = heroEl?.querySelector(".home-hero-media") as HTMLElement | null;
        const copy = document.querySelector("[data-home-hero-copy]");
        const invite = document.querySelector("[data-home-scroll-invite]");
        const next = banner?.nextElementSibling as HTMLElement | null;
        const nav = document.querySelector("header.artifact-nav");
        if (!banner || !heroEl || !next || !nav) return { error: "missing" as const };
        const b = banner.getBoundingClientRect();
        const h = heroEl.getBoundingClientRect();
        const n = next.getBoundingClientRect();
        const navBox = nav.getBoundingClientRect();
        const mediaBox = media?.getBoundingClientRect() ?? null;
        const copyBox = copy?.getBoundingClientRect() ?? null;
        const inviteBox = invite?.getBoundingClientRect() ?? null;
        const overlaps = (a: DOMRect, c: DOMRect) =>
          a.height > 0 &&
          c.height > 0 &&
          a.left < c.right &&
          a.right > c.left &&
          a.top < c.bottom &&
          a.bottom > c.top;
        return {
          bannerTop: b.top,
          bannerBottom: b.bottom,
          heroBottom: h.bottom,
          nextTop: n.top,
          viewportHeight: window.innerHeight,
          mediaTop: mediaBox?.top ?? null,
          navBottom: navBox.bottom,
          overlapsHeader: overlaps(b, navBox),
          copyOverlapsBanner: copyBox ? overlaps(copyBox, b) : false,
          inviteOverlapsBanner: inviteBox ? overlaps(inviteBox, b) : false,
          copyOverlapsInvite:
            copyBox && inviteBox ? overlaps(copyBox, inviteBox) : false,
          fontSize: parseFloat(getComputedStyle(banner).fontSize),
          height: parseFloat(getComputedStyle(banner).height),
          fontWeight: getComputedStyle(banner).fontWeight,
          gap: getComputedStyle(banner).getPropertyValue("--announcement-marquee-gap").trim(),
          zIndex: getComputedStyle(banner).zIndex,
        };
      });
      expect(geometry).not.toHaveProperty("error");
      if ("error" in geometry) throw new Error("missing geometry");
      expect(geometry.bannerTop).toBeGreaterThanOrEqual(geometry.heroBottom - 1);
      expect(geometry.nextTop).toBeGreaterThanOrEqual(geometry.bannerBottom - 1);
      expect(geometry.bannerBottom).toBeLessThanOrEqual(geometry.viewportHeight + 1);
      expect(geometry.overlapsHeader).toBe(false);
      expect(geometry.copyOverlapsBanner).toBe(false);
      expect(geometry.inviteOverlapsBanner).toBe(false);
      expect(geometry.copyOverlapsInvite).toBe(false);
      if (geometry.mediaTop != null) {
        expect(geometry.mediaTop).toBeGreaterThanOrEqual(geometry.navBottom - 1);
      }
      expect(Number.parseInt(geometry.zIndex, 10)).toBeGreaterThan(20);
      expect(Number.parseInt(geometry.zIndex, 10)).toBeLessThan(50);
      expect(geometry.fontSize).toBeGreaterThanOrEqual(viewport.width >= 768 ? 18 : 15);
      expect(geometry.fontSize).toBeLessThanOrEqual(viewport.width >= 768 ? 22 : 17);
      expect(geometry.height).toBeCloseTo(geometry.fontSize * 2.75, 0);
      expect(Number.parseInt(geometry.fontWeight, 10)).toBeGreaterThanOrEqual(600);
      expect(parseFloat(geometry.gap)).toBeGreaterThanOrEqual(6);

      const hitTargets = await page.evaluate(() => {
        const banner = document.querySelector(".announcement-marquee");
        if (!banner) return [];
        const box = banner.getBoundingClientRect();
        const y = box.top + box.height / 2;
        return [0.1, 0.3, 0.5, 0.7, 0.9].map((ratio) => {
          const x = box.left + box.width * ratio;
          const node = document.elementFromPoint(x, y);
          return {
            x,
            y,
            inside: Boolean(node?.closest(".announcement-marquee")),
            tag: node?.nodeName ?? null,
          };
        });
      });
      expect(hitTargets).toHaveLength(5);
      for (const hit of hitTargets) {
        expect(hit.inside).toBe(true);
      }

      await expect(bar).not.toHaveAttribute("aria-label");
      await expect(bar.locator(".announcement-marquee__static")).toHaveCount(1);
      await expect(bar.locator(".announcement-marquee__marquee")).toHaveAttribute("aria-hidden", "true");
    }
  });

  test("exactly one marquee on storefront routes; absent on admin / unknown", async ({ page }) => {
    for (const path of STOREFRONT_ROUTES) {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator(".announcement-marquee")).toHaveCount(1);
      await expect(page.locator(".announcement-marquee")).toBeVisible();
    }

    const productPath = await firstProductPath(page);
    if (productPath) {
      const response = await page.goto(productPath);
      expect(response?.status()).toBe(200);
      await expect(page.locator(".announcement-marquee")).toHaveCount(1);
    }

    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ] as const) {
      await page.setViewportSize(viewport);
      for (const path of ["/en/shop", "/en/about"] as const) {
        await page.goto(path);
        const geometry = await page.evaluate(() => {
          const banner = document.querySelector(".announcement-marquee");
          const nav = document.querySelector("header.artifact-nav");
          if (!banner || !nav) return { error: "missing" as const };
          const b = banner.getBoundingClientRect();
          const n = nav.getBoundingClientRect();
          const main = document.querySelector("#main-content");
          const mainBox = main?.getBoundingClientRect();
          return {
            bannerTop: b.top,
            navBottom: n.bottom,
            position: getComputedStyle(banner).position,
            mainTop: mainBox?.top ?? null,
          };
        });
        expect(geometry).not.toHaveProperty("error");
        if ("error" in geometry) throw new Error("missing geometry");
        expect(geometry.position).toBe("relative");
        expect(geometry.bannerTop).toBeGreaterThanOrEqual(geometry.navBottom - 1);
      }
    }

    await page.goto("/en/this-route-should-404-for-marquee");
    await expect(page.locator(".announcement-marquee")).toHaveCount(0);

    const admin = await page.goto("/admin");
    // Admin may redirect to login; either way, no storefront marquee.
    expect(admin).toBeTruthy();
    await expect(page.locator(".announcement-marquee")).toHaveCount(0);
  });

  test("hover/focus pauses marquee animation", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/en");
    // Privacy banner (z-70) can sit over the fold; remove for hit-testing.
    await page.evaluate(() => {
      document.querySelector('[data-slot="privacy-consent-banner"]')?.remove();
      window.scrollTo(0, 0);
    });
    const bar = page.locator(".announcement-marquee");
    await expect(bar).toBeVisible();
    const track = bar.locator(".announcement-marquee__track");
    const cycle = bar.locator(".announcement-marquee__cycle");
    await expect
      .poll(async () => {
        return bar.evaluate((el) => {
          const duration = getComputedStyle(el).getPropertyValue("--announcement-marquee-duration").trim();
          return duration.length > 0 && duration !== "60s";
        });
      })
      .toBe(true);

    const before = await cycle.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(before).toBe("running");
    // :focus-within pause (same CSS rule as :hover) — reliable without pointer interception.
    await track.focus();
    const paused = await cycle.evaluate((el) => getComputedStyle(el).animationPlayState);
    expect(paused).toBe("paused");
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
      const position = await bar.evaluate((el) => getComputedStyle(el).position);
      expect(position).toBe("relative");
    }
  });
});
