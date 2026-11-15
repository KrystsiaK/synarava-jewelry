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
  // proxy.ts short-link map → one 307 to /{locale}/shop?utm_…
  const hop = await request.get("/gift/box", { maxRedirects: 0 });
  expect(hop.status()).toBe(307);
  const location = hop.headers()["location"] ?? "";
  expect(location).toMatch(/\/(?:en|pt|ru)\/shop/);
  expect(location).toContain("utm_source=box");

  const response = await page.goto("/gift/box");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/utm_source=box/);
  await expect(page).toHaveURL(/\/(?:en|pt|ru)\/shop/);
});

test("print QR /gift/card Accept-Language is one 307 to published locale shop", async ({
  page,
  request,
}) => {
  // Accept-Language is consulted; match is among published locales only.
  // Smoke CI often has an empty registry → emergency `en` only, so pt-PT
  // correctly falls back to /en/shop. Unit tests cover pt-PT → /pt when
  // Portuguese is published.
  const hop = await request.get("/gift/card", {
    maxRedirects: 0,
    headers: { "Accept-Language": "pt-PT" },
  });
  expect(hop.status()).toBe(307);
  const location = hop.headers()["location"] ?? "";
  expect(location).toMatch(/\/(?:en|pt|ru)\/shop/);
  expect(location).toContain("utm_source=card");
  expect(hop.headers()["cache-control"]).toMatch(/no-store/i);

  await page.setExtraHTTPHeaders({ "Accept-Language": "pt-PT" });
  const response = await page.goto("/gift/card");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/(?:en|pt|ru)\/shop/);
  await expect(page).toHaveURL(/utm_source=card/);
});
