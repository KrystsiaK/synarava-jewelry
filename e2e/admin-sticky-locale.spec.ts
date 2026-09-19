import { hasAdminCredentials } from "./support/auth";
import { createTestPage } from "./support/factories";
import { expect, test } from "./support/fixtures";

test.describe("Admin locale workspace", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("keeps locale tabs pinned and switches without a save request", async ({ page, runId }) => {
    const testPage = await createTestPage(runId);
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto(`/admin/pages/${testPage.slug}`);

    const content = page.locator(".admin-content");
    const tabs = page.locator(".adm-locale-workspace-header");
    await content.evaluate((element) => { element.scrollTop = 900; });
    await expect(tabs).toBeVisible();

    const [contentBox, tabsBox] = await Promise.all([content.boundingBox(), tabs.boundingBox()]);
    expect(contentBox).not.toBeNull();
    expect(tabsBox).not.toBeNull();
    expect(Math.abs(tabsBox!.y - contentBox!.y)).toBeLessThanOrEqual(2);

    let writeRequests = 0;
    page.on("request", (request) => {
      if (request.method() !== "GET") writeRequests += 1;
    });
    await page.getByRole("tab", { name: "Português" }).click();
    await expect(page.getByRole("tab", { name: "Português" })).toHaveAttribute("aria-selected", "true");
    expect(writeRequests).toBe(0);
  });
});
