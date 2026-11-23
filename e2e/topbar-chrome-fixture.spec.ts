import path from "node:path";
import { pathToFileURL } from "node:url";

import { expect, test } from "@playwright/test";

/**
 * Fixture-based admin topbar chrome audit — no Next server, no DB, no auth.
 * Guards the shared height-budget contract: `.adm-topbar` never grows and never
 * paints over `.adm-page-title`, even with a long sync-signal title / tall child.
 */
const FIXTURE = pathToFileURL(
  path.join(process.cwd(), "e2e/support/admin-topbar-fixture.html"),
).href;

const VIEWPORTS = [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
] as const;

const THEMES = ["light", "dark"] as const;

function rectsOverlap(a: { x: number; y: number; width: number; height: number }, b: typeof a) {
  return !(
    a.x + a.width <= b.x
    || b.x + b.width <= a.x
    || a.y + a.height <= b.y
    || b.y + b.height <= a.y
  );
}

test.describe("admin topbar chrome fixture", () => {
  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      test(`${theme} ${viewport.width}px: sync badge keeps topbar height and clears page title`, async ({
        page,
      }) => {
        await page.setViewportSize(viewport);
        await page.goto(FIXTURE);
        await page.evaluate((nextTheme) => {
          document.documentElement.dataset.theme = nextTheme;
        }, theme);

        const topbar = page.getByTestId("adm-topbar");
        const signal = page.getByTestId("adm-sync-signal");
        const title = page.getByTestId("page-title");

        await expect(topbar).toBeVisible();
        await expect(signal).toBeVisible();
        await expect(title).toBeVisible();

        const metrics = await page.evaluate(() => {
          const top = document.querySelector("[data-testid='adm-topbar']") as HTMLElement;
          const sig = document.querySelector("[data-testid='adm-sync-signal']") as HTMLElement;
          const heading = document.querySelector("[data-testid='page-title']") as HTMLElement;
          const topBox = top.getBoundingClientRect();
          const sigBox = sig.getBoundingClientRect();
          const titleBox = heading.getBoundingClientRect();
          const styles = getComputedStyle(top);
          return {
            topbarHeight: topBox.height,
            topbarMaxHeight: styles.maxHeight,
            topbarOverflow: styles.overflow,
            signalBottom: sigBox.bottom,
            titleTop: titleBox.top,
            documentScrollWidth: document.documentElement.scrollWidth,
            documentClientWidth: document.documentElement.clientWidth,
            topBox: { x: topBox.x, y: topBox.y, width: topBox.width, height: topBox.height },
            sigBox: { x: sigBox.x, y: sigBox.y, width: sigBox.width, height: sigBox.height },
            titleBox: { x: titleBox.x, y: titleBox.y, width: titleBox.width, height: titleBox.height },
          };
        });

        // 4.25rem at default root font-size 16px → 68px
        expect(Math.round(metrics.topbarHeight)).toBe(68);
        expect(metrics.topbarMaxHeight).toBe("68px");
        expect(metrics.topbarOverflow).toMatch(/^(clip|hidden)$/);
        expect(metrics.signalBottom).toBeLessThanOrEqual(metrics.topbarHeight + 0.5);
        expect(metrics.titleTop).toBeGreaterThanOrEqual(metrics.topbarHeight);
        expect(rectsOverlap(metrics.sigBox, metrics.titleBox)).toBe(false);
        expect(metrics.documentScrollWidth).toBeLessThanOrEqual(metrics.documentClientWidth + 1);
      });
    }
  }

  test("375px: tall probe inside topbar is clipped and does not overlap page title", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(FIXTURE);
    await page.getByTestId("topbar-tall-probe").evaluate((el) => {
      el.removeAttribute("hidden");
    });

    const overlap = await page.evaluate(() => {
      const probe = document.querySelector("[data-testid='topbar-tall-probe']") as HTMLElement;
      const title = document.querySelector("[data-testid='page-title']") as HTMLElement;
      const topbar = document.querySelector("[data-testid='adm-topbar']") as HTMLElement;
      const probeBox = probe.getBoundingClientRect();
      const titleBox = title.getBoundingClientRect();
      const topBox = topbar.getBoundingClientRect();
      // Visible paint of the probe cannot extend past the topbar clip edge.
      const visibleBottom = Math.min(probeBox.bottom, topBox.bottom);
      return {
        topbarHeight: topBox.height,
        probeBottom: probeBox.bottom,
        visibleBottom,
        titleTop: titleBox.top,
        overlapsTitle:
          !(probeBox.x + probeBox.width <= titleBox.x
            || titleBox.x + titleBox.width <= probeBox.x
            || visibleBottom <= titleBox.y
            || titleBox.y + titleBox.height <= probeBox.y),
      };
    });

    expect(Math.round(overlap.topbarHeight)).toBe(68);
    expect(overlap.visibleBottom).toBeLessThanOrEqual(overlap.topbarHeight + 0.5);
    expect(overlap.overlapsTitle).toBe(false);
  });
});
