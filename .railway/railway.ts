/**
 * Railway Infrastructure as Code (GA) — sku slice only.
 *
 * Config as Code (`railway.json` / `railway.toml`) is deprecated for new services
 * and overrides dashboard settings. This partial manages sku-api + sku-postgres
 * without touching the existing synarava-web legacy CaC path.
 *
 * Docs:
 * - https://docs.railway.com/infrastructure-as-code
 * - https://docs.railway.com/infrastructure-as-code/reference
 * - https://docs.railway.com/deployments/monorepo
 *
 * Apply (staging):
 *   railway link   # project + staging environment
 *   railway config plan
 *   railway config apply
 *
 * Web deploy stays on: deploy/railway.synarava-web.json (legacy CaC until migrated).
 */
import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

/** Named partial so apply only owns sku resources (does not delete web). */
export const partial = "sku";

export default defineRailway((ctx) => {
  if (!ctx.isEnvironment("staging") || ctx.projectName !== "synarava-shop") {
    throw new Error(
      `Refusing to manage ${ctx.projectName}/${ctx.environmentName}: expected synarava-shop/staging.`,
    );
  }

  const skuPostgres = postgres("sku-postgres");

  const skuApi = service("sku-api", {
    source: github("KrystsiaK/synarava-jewelry", { branch: "staging" }),
    // Shared monorepo root — pnpm workspace filters, not an isolated package root.
    build:
      "pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build",
    preDeploy: "pnpm --filter @synarava/sku-api prisma:deploy",
    start: "pnpm --filter @synarava/sku-api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      SKU_DATABASE_URL: skuPostgres.env.DATABASE_URL,
      SKU_API_CREDENTIALS: preserve(),
    },
  });

  return project(ctx.projectName, {
    resources: [skuPostgres, skuApi],
  });
});
