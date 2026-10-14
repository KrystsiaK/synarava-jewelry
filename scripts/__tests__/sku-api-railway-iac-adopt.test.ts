import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SKU_API_WATCH_PATTERNS } from "../../.railway/railway.ts";

/**
 * Regression: config plan flipped checkSuites / cleared watchPatterns when
 * IaC used bare github() + string build. Keep live staging adopt fields.
 */
describe("sku-api Railway IaC adopt fields", () => {
  const railwayTs = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../.railway/railway.ts"),
    "utf8",
  );

  it("pins source.checkSuites true for sku-api", () => {
    expect(railwayTs).toMatch(/checkSuites:\s*true/);
  });

  it("exports watchPatterns matching documented staging list", () => {
    expect([...SKU_API_WATCH_PATTERNS]).toEqual([
      "/services/sku-api/**",
      "/packages/sku-core/**",
      "/packages/sku-contract/**",
      "/pnpm-lock.yaml",
      "/pnpm-workspace.yaml",
      "/package.json",
      "/.railway/**",
    ]);
    expect(railwayTs).toContain("watchPatterns: [...SKU_API_WATCH_PATTERNS]");
  });
});
