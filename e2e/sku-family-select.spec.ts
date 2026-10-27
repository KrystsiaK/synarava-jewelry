import {
  createPrivacyConsent,
  PRIVACY_CONSENT_COOKIE,
  serializePrivacyConsent,
} from "@/lib/privacy/consent";

import { hasAdminCredentials } from "./support/auth";
import { createTestProduct, createTestProductVariant, db } from "./support/factories";
import { expect, test } from "./support/fixtures";

/**
 * Prod bug: form onInput={markDirty} re-renders before native select `change`,
 * wiping Family. Requires real mouse + keyboard (not selectOption).
 */
test.describe("SKU Family select stays sticky", () => {
  test.beforeEach(() => {
    test.skip(!hasAdminCredentials(), "Local admin credentials are not configured.");
  });

  test("mouse click and keyboard keep Family and enable Preview/Confirm", async ({
    page,
    runId,
  }) => {
    const product = await createTestProduct(runId, {
      name: `E2E SKU Family ${runId}`,
    });
    const pendingSku = `PENDING-${runId.slice(0, 8)}`.toUpperCase();
    await createTestProductVariant(product.id, { sku: pendingSku });
    await db.product.update({
      where: { id: product.id },
      data: { sku: pendingSku },
    });

    // auth.setup cookies target localhost; this suite binds 127.0.0.1.
    await page.context().addCookies([
      {
        name: PRIVACY_CONSENT_COOKIE,
        value: serializePrivacyConsent(
          createPrivacyConsent({ preferences: true, analytics: false, marketing: false }),
        ),
        url: "http://127.0.0.1:3000",
      },
    ]);

    await page.goto(`/admin/products/${product.id}`);
    await page.waitForLoadState("networkidle");

    // Activate Stock. Playwright pointer trips AdminSectionTabs' pan-vs-click guard;
    // invoke React onClick (any engine prop key) twice — first clears pannedRef.
    const stockTab = page.locator("#product-editor-tab-inventory");
    await expect
      .poll(async () =>
        stockTab.evaluate((el: HTMLButtonElement) => {
          const event = {
            preventDefault() {},
            stopPropagation() {},
            nativeEvent: { stopImmediatePropagation() {} },
          };
          for (const key of Object.keys(el)) {
            const props = (el as unknown as Record<string, { onClick?: (e: unknown) => void }>)[key];
            if (props && typeof props.onClick === "function") {
              props.onClick(event);
              props.onClick(event);
              return el.getAttribute("aria-selected");
            }
          }
          el.click();
          el.click();
          return el.getAttribute("aria-selected");
        }),
      )
      .toBe("true");

    const family = page.getByLabel(/^Family/);
    await expect(family).toBeVisible({ timeout: 15_000 });
    await expect(family).toHaveValue("");
    await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();

    const optionValues = await family.evaluate((el: HTMLSelectElement) =>
      [...el.options].map((o) => o.value).filter(Boolean),
    );
    expect(optionValues.length).toBeGreaterThan(0);

    // --- Keyboard (not selectOption): ArrowDown fires native input→change ---
    await family.focus();
    await family.press("ArrowDown");
    await expect(family).not.toHaveValue("");
    const keyboardValue = await family.inputValue();
    expect(optionValues).toContain(keyboardValue);
    await expect(page.getByRole("button", { name: "Preview" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Confirm assign" })).toBeEnabled();

    // Reset to blank for the mouse path.
    await family.focus();
    await family.press("Home");
    await expect(family).toHaveValue("");
    await expect(page.getByRole("button", { name: "Preview" })).toBeDisabled();

    // --- Mouse: click to focus/open, ArrowDown, Enter to commit (not selectOption) ---
    await family.click();
    await family.press("ArrowDown");
    await family.press("Enter");
    await expect(family).not.toHaveValue("");
    const mouseValue = await family.inputValue();
    expect(optionValues).toContain(mouseValue);
    await expect(page.getByRole("button", { name: "Preview" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Confirm assign" })).toBeEnabled();
  });
});
