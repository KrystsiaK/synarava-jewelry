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
    ]);
    expect(SKU_API_WATCH_PATTERNS).not.toContain("/.railway/**");
    expect(railwayTs).toContain("watchPatterns: [...SKU_API_WATCH_PATTERNS]");
  });

  it("runs staging n8n with access to its Railway volume", () => {
    expect(railwayTs).toMatch(/volume\("n8n-data-v2"/);
    expect(railwayTs).toMatch(/region:\s*"europe-west4-drams3a"/);
    expect(railwayTs).toMatch(/RAILWAY_RUN_UID:\s*"0"/);
    expect(railwayTs).toMatch(/N8N_USER_FOLDER:\s*"\/home\/node"/);
  });

  it("pins sku-api listen port and hardcodes it in n8n SKU_API_URL", () => {
    expect(railwayTs).toMatch(/PORT:\s*"8080"/);
    // `${{sku-api.PORT}}` resolves empty — must use literal :8080.
    expect(railwayTs).toContain(
      'SKU_API_URL: "http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080"',
    );
    expect(railwayTs).not.toContain("${{sku-api.PORT}}");
  });

  it("allows n8n Code nodes to read $env (CATALOG_ITEMS_JSON)", () => {
    expect(railwayTs).toMatch(/N8N_BLOCK_ENV_ACCESS_IN_NODE:\s*"false"/);
  });
});
