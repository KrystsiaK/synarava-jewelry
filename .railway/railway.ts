/**
 * Railway Infrastructure as Code (GA) — portable SKU platform slice (staging).
 *
 * Architecture (2026-10-14):
 * - Target Railway project: `portable-sku-platform` (multi-workspace SKU API).
 * - Interim: manage existing `sku-api` + `sku-postgres` in **handsome-commitment**.
 * - Do **NOT** create sku-api / n8n duplicates inside `synarava-shop`
 *   (Synarava web is HTTPS client only — no cross-project private `${{service.*}}`).
 *
 * **Do not `railway config apply` until Kiryl confirms** the architecture plan:
 *   store docs/portable-sku-platform-architecture.md
 *   docs/runbooks/portable-sku-platform-railway.md
 *
 * Docs:
 * - https://docs.railway.com/infrastructure-as-code
 * - https://docs.railway.com/deployments/monorepo
 */
import {
  defineRailway,
  github,
  postgres,
  preserve,
  project,
  service,
} from "railway/iac";

/** Named partial — owns SKU platform resources only (never synarava-web). */
export const partial = "sku";

/**
 * Interim project that already hosts staging sku-api (GitHub check
 * `handsome-commitment - sku-api`). Flip to `portable-sku-platform` after
 * Kiryl creates/renames the project — still staging-only.
 */
const SKU_PLATFORM_PROJECT = "handsome-commitment";

export default defineRailway((ctx) => {
  if (!ctx.isEnvironment("staging")) {
    throw new Error(
      `Refusing to manage ${ctx.projectName}/${ctx.environmentName}: staging only. Production is out of scope for this partial.`,
    );
  }

  if (ctx.projectName === "synarava-shop") {
    throw new Error(
      "Refusing synarava-shop: do not create sku-api/sku-postgres/n8n duplicates next to the storefront. Synarava calls the SKU API over HTTPS.",
    );
  }

  if (ctx.projectName !== SKU_PLATFORM_PROJECT) {
    throw new Error(
      `Refusing ${ctx.projectName}/${ctx.environmentName}: expected ${SKU_PLATFORM_PROJECT}/staging (interim). Target rename: portable-sku-platform.`,
    );
  }

  // Existing staging data plane — IaC adopts; does not invent a second Postgres in synarava-shop.
  const skuPostgres = postgres("sku-postgres");

  const skuApi = service("sku-api", {
    source: github("KrystsiaK/synarava-jewelry", { branch: "staging" }),
    build:
      "pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build",
    preDeploy: "pnpm --filter @synarava/sku-api prisma:deploy",
    start: "pnpm --filter @synarava/sku-api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      SKU_DATABASE_URL: skuPostgres.env.DATABASE_URL,
      SKU_API_CREDENTIALS: preserve(),
      // Cross-project clients use public HTTPS + Bearer; tune after expose.
      SKU_API_RATE_LIMIT_PER_MIN: preserve(),
    },
  });

  // n8n stays out of this partial until platform project cutover.
  // Production already has sku-platform-n8n (+ postgres) — do not recreate here.

  return project(ctx.projectName, {
    resources: [skuPostgres, skuApi],
  });
});
