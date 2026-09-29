import { createHash } from "node:crypto";

import { expect, test } from "@playwright/test";

const NOTICE_COOKIE = "synarava-buy-again-notice";
const REPLAY_COOKIE = "synarava-buy-again-replay";

function replayHash(locale: string, canonical: string) {
  return createHash("sha256").update(`${locale}\n${canonical}`).digest("hex");
}

test.describe("Buy again cart notice", () => {
  test("keeps the notice after hydration, clears on reload, and does not re-add on replay", async ({
    context,
    page,
  }) => {
    await page.goto("/en/cart");
    const cookieUrl = page.url();

    await context.addCookies([
      {
        name: NOTICE_COOKIE,
        value: "completed|2|0",
        url: cookieUrl,
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
      },
      {
        name: REPLAY_COOKIE,
        value: replayHash("en", "1:1"),
        url: cookieUrl,
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
      },
    ]);

    const clearResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/cart/buy-again-notice") &&
        response.request().method() === "POST" &&
        response.status() === 204,
    );

    await page.goto("/en/cart");
    const notice = page.getByRole("status").filter({
      hasText: "Added 2 items from your previous order.",
    });
    await expect(notice).toBeVisible();
    await clearResponse;

    // Cookie clear via Route Handler must not wipe the already-shown notice.
    await expect(notice).toBeVisible();
    await expect
      .poll(async () => notice.isVisible(), { timeout: 2_000 })
      .toBe(true);

    await page.reload();
    await expect(
      page.getByRole("status").filter({
        hasText: "Added 2 items from your previous order.",
      }),
    ).toHaveCount(0);

    // Replay window: same permalink must not add merchandise; cart stays empty.
    await page.goto("/en/cart/1:1");
    await expect(page).toHaveURL(/\/en\/cart\/?$/);
    await expect(
      page.getByRole("status").filter({
        hasText: "Those items were already added. Your cart is ready.",
      }),
    ).toBeVisible();
    await expect(page.getByText("Nothing selected")).toBeVisible();
  });
});
