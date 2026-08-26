import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("renders without client script-tag errors", async ({ page }) => {
    const scriptErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && message.text().includes("Encountered a script tag")) {
        scriptErrors.push(message.text());
      }
    });

    await page.goto("/");
    await expect(page.locator(".home-hero h1")).toBeVisible();
    expect(scriptErrors).toEqual([]);
  });

  test("loads and shows hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".home-hero h1")).toBeVisible();
  });

  test("shows SYNARAVA wordmark in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("SYNARAVA").first()).toBeVisible();
  });

  test("shows navigation links", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Shop" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Collections" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "About" }).first()).toBeVisible();
  });

  test("uses the shared service footer", async ({ page }) => {
    await page.goto("/");
    const footer = page.locator("footer");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link", { name: "Shipping" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Returns" })).toBeVisible();
    await expect(footer.getByRole("link", { name: "Contact: studio@synarava.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Shipping" })).toHaveCount(1);
  });

  test("gives editorial sections a legible light-theme surface", async ({ page }) => {
    await page.goto("/");
    const switcher = page.getByRole("banner").getByRole("group", { name: "Theme switcher" });
    await switcher.getByRole("button", { name: "Light" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    const section = page.locator('section[aria-labelledby="department-pathway-title"]');
    await expect(section.getByRole("heading", { name: "Choose where to begin." })).toBeVisible();

    const colors = await section.evaluate((element) => {
      const sectionStyle = getComputedStyle(element);
      const heading = element.querySelector("h2");
      const body = element.querySelector("h2 + p");
      return {
        background: sectionStyle.backgroundColor,
        linen: sectionStyle.getPropertyValue("--color-linen").trim(),
        stoneBeige: sectionStyle.getPropertyValue("--color-stone-beige").trim(),
        heading: heading ? getComputedStyle(heading).color : "",
        body: body ? getComputedStyle(body).color : "",
      };
    });

    expect(colors).toMatchObject({
      linen: "#211e1b",
      stoneBeige: "#6b645d",
      heading: "rgb(33, 30, 27)",
      body: "rgb(107, 100, 93)",
    });
    expect(colors.background).not.toBe("rgb(10, 10, 11)");

    await section.scrollIntoViewIfNeeded();
    await expect(page.getByRole("banner")).toHaveAttribute("data-scrolled", "true");
    await expect(page.locator(".site-nav-liquid-glass")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );

    const headerSurface = await page.evaluate(() => ({
      navColor: getComputedStyle(document.querySelector('header a[href="/"]')!).color,
    }));
    expect(headerSurface).toEqual({
      navColor: "rgb(25, 24, 23)",
    });

    await switcher.getByRole("button", { name: "Dark" }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(section).toHaveCSS("background-color", "rgb(10, 10, 11)");
    await expect(section.getByRole("heading", { name: "Choose where to begin." })).toHaveCSS(
      "color",
      "rgb(249, 248, 246)",
    );
  });

  test("keeps the mobile header glass over the light-theme finale", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.context().addCookies([
      { name: "synarava-theme", value: "light", url: "http://localhost:3000" },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.locator(".home-final-scene").last().scrollIntoViewIfNeeded();
    await expect(page.getByRole("banner")).toHaveAttribute("data-scrolled", "true");
    const mobileGlass = await page.locator(".site-nav-mobile-glass").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        backgroundImage: style.backgroundImage,
      };
    });
    expect(mobileGlass.backgroundColor).not.toBe("rgba(249, 248, 246, 0.97)");
    expect(mobileGlass.backgroundImage).toContain("linear-gradient");
    await expect(page.locator(".site-nav-icon-button")).toHaveCSS(
      "color",
      "rgb(25, 24, 23)",
    );
  });

  test("cart link is present in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Cart/ })).toBeVisible();
  });

  test("keeps all three Lexicon plates connected to mobile page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const lexicon = page.locator('section[aria-labelledby="lexicon-title"]');
    const whiteCeramic = lexicon.getByRole("article").nth(0);
    const ancientOak = lexicon.getByRole("article").nth(1);
    const rawObsidian = lexicon.getByRole("article").nth(2);

    const scrollLexiconTo = async (progress: number) => {
      await lexicon.evaluate((element, value) => {
        const rect = element.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const distance = rect.height - document.documentElement.clientHeight;
        window.scrollTo({ top: start + distance * value, behavior: "instant" });
      }, progress);
    };

    const clipPath = (locator: typeof whiteCeramic) =>
      locator.evaluate((element) => getComputedStyle(element).clipPath);

    await scrollLexiconTo(0);
    await expect.poll(() => clipPath(whiteCeramic)).toContain("0% 0%");

    await scrollLexiconTo(0.5);
    await expect.poll(() => clipPath(ancientOak)).toContain("0% 0%");
    await expect.poll(() => clipPath(rawObsidian)).toContain("108% 0%");

    await scrollLexiconTo(0.9);
    await expect.poll(() => clipPath(rawObsidian)).toContain("0% 0%");
  });

  test("keeps a lightweight two-shard final animation on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const finalScene = page.locator(".home-final-scene").last();
    await finalScene.scrollIntoViewIfNeeded();
    await expect(finalScene.locator("[data-mobile-final-shard]")).toHaveCount(2);
    await expect(finalScene.locator("[data-mobile-final-shard]").first()).toBeVisible();
    await expect(finalScene.getByText("Objects shaped slowly,")).toBeVisible();
    await expect(finalScene.getByRole("link", { name: "studio@synarava.com" })).toBeVisible();
    expect(await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    )).toBe(false);
  });

  test("does not remeasure Home targets on every scroll frame", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    ));

    await page.evaluate(() => {
      const state = window as Window & { __homeRectReads?: number };
      const original = Element.prototype.getBoundingClientRect;
      state.__homeRectReads = 0;
      Element.prototype.getBoundingClientRect = function getBoundingClientRect() {
        state.__homeRectReads = (state.__homeRectReads ?? 0) + 1;
        return original.call(this);
      };
    });

    await page.evaluate(async () => {
      for (let index = 1; index <= 24; index += 1) {
        window.scrollTo(0, index * 140);
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
    });

    const rectReads = await page.evaluate(
      () => (window as Window & { __homeRectReads?: number }).__homeRectReads ?? 0,
    );
    expect(rectReads).toBeLessThan(8);
  });

  test("uses compositor-friendly stepped Lexicon navigation on iOS", async ({ page }) => {
    await page.addInitScript(() => {
      const state = window as Window & { __scrollListenerCount?: number };
      const originalAddEventListener = window.addEventListener;
      state.__scrollListenerCount = 0;
      window.addEventListener = ((
        type: string,
        listener: EventListenerOrEventListenerObject,
        options?: boolean | AddEventListenerOptions,
      ) => {
        if (type === "scroll") {
          state.__scrollListenerCount = (state.__scrollListenerCount ?? 0) + 1;
        }
        return originalAddEventListener.call(window, type, listener, options);
      }) as typeof window.addEventListener;

      Object.defineProperties(navigator, {
        userAgent: {
          configurable: true,
          value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
        },
        platform: { configurable: true, value: "iPhone" },
        maxTouchPoints: { configurable: true, value: 5 },
      });
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const scrollListenerCount = await page.evaluate(
      () => (window as Window & { __scrollListenerCount?: number }).__scrollListenerCount ?? 0,
    );
    expect(scrollListenerCount).toBe(0);

    const lexicon = page.locator('section[aria-labelledby="lexicon-title"]');
    const whiteCeramic = lexicon.getByRole("article").nth(0);
    const ancientOak = lexicon.getByRole("article").nth(1);
    const rawObsidian = lexicon.getByRole("article").nth(2);

    const scrollLexiconTo = async (progress: number) => {
      await lexicon.evaluate((element, value) => {
        const rect = element.getBoundingClientRect();
        const start = rect.top + window.scrollY;
        const distance = rect.height - document.documentElement.clientHeight;
        window.scrollTo({ top: start + distance * value, behavior: "instant" });
      }, progress);
    };
    const opacity = (locator: typeof whiteCeramic) =>
      locator.evaluate((element) => getComputedStyle(element).opacity);

    await scrollLexiconTo(0);
    await expect.poll(() => opacity(whiteCeramic)).toBe("1");

    await scrollLexiconTo(0.5);
    await expect.poll(() => opacity(ancientOak)).toBe("1");
    await expect.poll(() => opacity(rawObsidian)).toBe("0");

    await scrollLexiconTo(0.95);
    await expect.poll(() => opacity(rawObsidian)).toBe("1");
  });
});
