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
    await expect(page.getByRole("heading", { name: "Artifacts of time" })).toBeVisible();
    expect(scriptErrors).toEqual([]);
  });

  test("loads and shows hero heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Artifacts of time" })).toBeVisible();
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

  test("uses the home-owned ending instead of the global footer", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("footer")).toBeHidden();
  });

  test("cart link is present in header", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Cart/ })).toBeVisible();
  });

  test("keeps all three Lexicon plates connected to mobile page scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    const lexicon = page.locator('section[aria-labelledby="lexicon-title"]');
    const whiteCeramic = page.getByLabel("01. White Ceramic");
    const ancientOak = page.getByLabel("02. Ancient Oak");
    const rawObsidian = page.getByLabel("03. Raw Obsidian");

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

  test("does not remeasure Home targets on every scroll frame", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

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
    const whiteCeramic = page.getByLabel("01. White Ceramic");
    const ancientOak = page.getByLabel("02. Ancient Oak");
    const rawObsidian = page.getByLabel("03. Raw Obsidian");

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
