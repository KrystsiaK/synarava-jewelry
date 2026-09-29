import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Soft accessibility probe against production templates.
 * Critical/serious violations are logged and attached; the suite fails only on
 * navigation errors so CI can stay advisory (workflow continue-on-error).
 */
const PATHS = [
  "/en",
  "/en/products/golden-bird-brooch",
  "/en/collections/jewellery",
] as const;

for (const path of PATHS) {
  test(`axe soft: ${path}`, async ({ page }, testInfo) => {
    const response = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(response?.ok() ?? false, `expected 2xx for ${path}`).toBe(true);

    // Dismiss consent chrome so axe focuses on page structure, not the banner.
    const rejectOptional = page.getByRole("button", { name: /reject optional/i });
    if (await rejectOptional.isVisible().catch(() => false)) {
      await rejectOptional.click();
    }

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    const notable = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );

    await testInfo.attach(`axe-${path.replace(/\//g, "_") || "root"}.json`, {
      body: JSON.stringify(
        {
          url: results.url,
          violationCount: results.violations.length,
          notable: notable.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
          all: results.violations.map((v) => ({
            id: v.id,
            impact: v.impact,
            description: v.description,
            nodes: v.nodes.length,
          })),
        },
        null,
        2,
      ),
      contentType: "application/json",
    });

    if (notable.length > 0) {
      console.warn(
        `[a11y-prod-soft] ${path}: ${notable.length} critical/serious violation(s)`,
        notable.map((v) => `${v.id} (${v.impact})`).join(", "),
      );
    }

    // Soft gate: surface counts without failing the job on known a11y debt.
    expect(results.violations, "axe ran").toBeDefined();
  });
}
