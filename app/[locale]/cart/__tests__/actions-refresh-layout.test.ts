import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("cart actions refreshCommerce", () => {
  it("revalidates the root layout so the header cart badge cannot go stale", () => {
    const source = readFileSync(
      join(process.cwd(), "app/[locale]/cart/actions.ts"),
      "utf8",
    );
    expect(source).toMatch(/function refreshCommerce\s*\(/);
    expect(source).toMatch(/revalidateStorefrontPath\(\s*["']\/["']\s*,\s*["']layout["']\s*\)/);
  });
});
