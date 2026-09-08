import { hasAdminCredentials } from "./support/auth";
import { createTestPage } from "./support/factories";
import { expect, test } from "./support/fixtures";

// Runs in the "chromium-admin" project (see playwright.config.ts), which
// starts every test already authenticated via the storage state produced by
// support/auth.setup.ts. No login boilerplate needed here.
test.describe("Admin studio layout", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("keeps the desktop sidebar autonomous from page content", async ({ page, runId }) => {
    // The page-editor form is reliably tall (title, slug, workflow state, PT
    // translations, excerpt, body, CTA, quote, secondary block) regardless of
    // what real content this environment's database happens to hold — that's
    // exactly what this test needs to exercise the sidebar/content scroll
    // independence at a small viewport.
    const testPage = await createTestPage(runId);

    await page.setViewportSize({ width: 1280, height: 640 });
    await page.goto(`/admin/pages/${testPage.slug}`);
    await expect(page.getByRole("heading", { name: testPage.title }).first()).toBeVisible();

    const sidebar = page.locator(".admin-sidebar-shell");
    const sidebarScroll = page.locator(".admin-sidebar-scroll");
    const content = page.locator(".admin-content");
    const footer = page.locator(".admin-sidebar-footer");
    const topbar = page.locator(".adm-topbar");

    await expect(sidebar).toBeVisible();
    await expect(footer).toBeVisible();

    const sidebarBox = await sidebar.boundingBox();
    const contentBox = await content.boundingBox();
    const topbarBox = await topbar.boundingBox();

    expect(sidebarBox).not.toBeNull();
    expect(contentBox).not.toBeNull();
    expect(topbarBox).not.toBeNull();
    expect(Math.round(sidebarBox!.width)).toBe(256);
    expect(Math.round(sidebarBox!.y)).toBe(Math.round(topbarBox!.height));
    expect(Math.round(contentBox!.x)).toBe(Math.round(sidebarBox!.width));

    await content.evaluate((element) => {
      element.scrollTop = 240;
    });

    expect(await sidebarScroll.evaluate((element) => element.scrollTop)).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await sidebarScroll.evaluate((element) => {
      element.scrollTop = 120;
    });

    expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);

    const footerBox = await footer.boundingBox();
    expect(footerBox).not.toBeNull();
    expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(640);
  });

  test("keeps admin topbar fixed while page scrolls", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin");

    const topbar = page.locator(".adm-topbar");
    await expect(topbar).toBeVisible();
    const before = await topbar.boundingBox();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    const after = await topbar.boundingBox();

    expect(before).not.toBeNull();
    expect(after).not.toBeNull();
    expect(Math.round(before!.y)).toBe(0);
    expect(Math.round(after!.y)).toBe(0);
  });

  test("does not create horizontal overflow on the products list", async ({ page }) => {
    await page.setViewportSize({ width: 778, height: 881 });
    await page.goto("/admin/products");
    await expect(page.getByRole("heading", { name: "Products list" })).toBeVisible();

    const overflow = await page.evaluate(() => ({
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth,
      bodyClientWidth: document.body.clientWidth,
      bodyScrollWidth: document.body.scrollWidth,
    }));

    expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.documentClientWidth + 1);
    expect(overflow.bodyScrollWidth).toBeLessThanOrEqual(overflow.bodyClientWidth + 1);
  });
});
