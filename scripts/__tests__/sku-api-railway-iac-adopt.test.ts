import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PROD_N8N_IMAGE,
  PROD_N8N_POSTGRES_SERVICE_ID,
  PROD_N8N_POSTGRES_VOLUME_NAME,
  PROD_N8N_SERVICE_ID,
  PROD_N8N_VOLUME_NAME,
  PROD_SKU_API_GITHUB_BRANCH,
  SKU_API_WATCH_PATTERNS,
  SKU_PLATFORM_PRODUCTION_ENV_ID,
  SKU_PLATFORM_PROJECT_ID,
  STAGING_N8N_IMAGE,
} from "../../.railway/railway.ts";

/**
 * Regression: config plan flipped checkSuites / cleared watchPatterns when
 * IaC used bare github() + string build. Keep live staging adopt fields.
 * Stage 6: production guards + adopt existing n8n* without recreate.
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

describe("Stage 6 production Railway IaC guards + adopt", () => {
  const railwayTs = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../../.railway/railway.ts"),
    "utf8",
  );
  const productionPlanCheck = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      "../sku-platform-production-plan-check.sh",
    ),
    "utf8",
  );

  it("guards immutable project id and production environment id", () => {
    expect(SKU_PLATFORM_PROJECT_ID).toBe(
      "6d7d5885-43eb-4283-b4a4-e552fc6dba7b",
    );
    expect(SKU_PLATFORM_PRODUCTION_ENV_ID).toBe(
      "d8cb7dd8-5c26-4255-a8c5-7795f1993de6",
    );
    expect(railwayTs).toContain(SKU_PLATFORM_PROJECT_ID);
    expect(railwayTs).toContain(SKU_PLATFORM_PRODUCTION_ENV_ID);
    expect(railwayTs).toMatch(/isEnvironment\("production"\)/);
    expect(railwayTs).toMatch(/environmentId !== SKU_PLATFORM_PRODUCTION_ENV_ID/);
  });

  it("adopts production n8n + postgres by live names (not staging names)", () => {
    expect(railwayTs).toMatch(/service\("sku-platform-n8n"/);
    expect(railwayTs).toMatch(/postgres\("sku-platform-n8n-postgres"\)/);
    expect(railwayTs).toContain("volume(PROD_N8N_VOLUME_NAME");
    expect(PROD_N8N_VOLUME_NAME).toBe("sku-platform-n8n-volume");
    expect(PROD_N8N_POSTGRES_VOLUME_NAME).toBe("postgres-volume");
    expect(PROD_N8N_SERVICE_ID).toBe("04d32fed-eae9-4219-8ebb-cc6cbc403c37");
    expect(PROD_N8N_POSTGRES_SERVICE_ID).toBe(
      "e7f8a122-dfb5-498e-8002-23fb0f50e3ca",
    );
  });

  it("pins separate staging vs production n8n images (no shared upgrade)", () => {
    expect(STAGING_N8N_IMAGE).toBe("n8nio/n8n:2.44.1");
    expect(PROD_N8N_IMAGE).toBe("n8nio/n8n:2.42.7");
    expect(STAGING_N8N_IMAGE).not.toBe(PROD_N8N_IMAGE);
    expect(railwayTs).toContain("STAGING_N8N_IMAGE");
    expect(railwayTs).toContain("PROD_N8N_IMAGE");
    expect(railwayTs).toMatch(/image\(STAGING_N8N_IMAGE/);
    expect(railwayTs).toMatch(/image\(PROD_N8N_IMAGE/);
    // No shared N8N_IMAGE constant for both envs.
    expect(railwayTs).not.toMatch(/export const N8N_IMAGE\s*=/);
  });

  it("documents production safe github branch", () => {
    expect(PROD_SKU_API_GITHUB_BRANCH).toBe("main");
    expect(railwayTs).toContain("PROD_SKU_API_GITHUB_BRANCH");
    expect(railwayTs).toMatch(/autoUpdates:\s*\{\s*type:\s*"disabled"/);
  });

  it("blocks production plan until main contains the complete staging history", () => {
    expect(productionPlanCheck).toContain("git fetch --quiet origin main staging");
    expect(productionPlanCheck).toContain(
      "git merge-base --is-ancestor origin/staging origin/main",
    );
    expect(productionPlanCheck).toContain("through PR #148");
  });

  it("creates isolated production sku-api + sku-postgres", () => {
    expect(railwayTs).toMatch(/postgres\("sku-postgres"\)/);
    expect(railwayTs).toMatch(/service\("sku-api"/);
  });
});
