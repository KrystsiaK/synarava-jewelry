import { expect, test } from "@playwright/test";

test("storefront loads and exposes primary navigation", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);
  await expect(page.locator("main")).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop" }).first()).toBeVisible();
});

test("print QR /gift/box redirects to shop with utm_source=box", async ({
  page,
  request,
}) => {
  // next.config redirects() run before proxy (307 temporary).
  // https://nextjs.org/docs/app/api-reference/file-conventions/proxy#execution-order
  const hop = await request.get("/gift/box", { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  const location = hop.headers()["location"] ?? "";
  expect(location).toContain("/shop");
  expect(location).toContain("utm_source=box");

  const response = await page.goto("/gift/box");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/utm_source=box/);
  await expect(page).toHaveURL(/\/(?:en|pt)\/shop/);
});
