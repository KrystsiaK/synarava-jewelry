import { expect, test } from "@playwright/test";

type CapturedEvent = {
  event: string;
  properties: Record<string, unknown>;
};

test.describe("Commerce analytics contract", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.addEventListener("synarava:commerce-event", (event) => {
        const detail = (event as CustomEvent).detail;
        const captured = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]");
        captured.push(detail);
        sessionStorage.setItem("test:commerce-events", JSON.stringify(captured));
      });
    });
  });

  test("emits department entry and product view without a vendor SDK", async ({ page }) => {
    await page.goto("/");

    const departmentLink = page
      .locator('section[aria-labelledby="department-pathway-title"] a[href^="/shop?department="]')
      .first();
    await expect(departmentLink).toBeVisible();
    const department = new URL(await departmentLink.getAttribute("href") ?? "", "http://localhost").searchParams.get("department");
    await departmentLink.click();

    await expect.poll(async () => page.evaluate(() => {
      const events = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]") as CapturedEvent[];
      return events.some((event) => event.event === "department_entry");
    })).toBe(true);

    const entry = await page.evaluate(() => {
      const events = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]") as CapturedEvent[];
      return events.find((event) => event.event === "department_entry");
    });
    expect(entry?.properties).toMatchObject({ department, source: "home" });

    const productLink = page.locator('a[href^="/products/"]').first();
    await expect(productLink).toBeVisible();
    await productLink.click();

    await expect.poll(async () => page.evaluate(() => {
      const events = JSON.parse(sessionStorage.getItem("test:commerce-events") ?? "[]") as CapturedEvent[];
      return events.some((event) => event.event === "view_item");
    })).toBe(true);
  });
});
