/**
 * Railway Infrastructure as Code (GA) — portable SKU platform slice (staging).
 *
 * Architecture (confirmed rename 2026-10-14):
 * - Railway project **portable-sku-platform** (was handsome-commitment).
 * - Immutable project ID: `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` (IaC guard uses ID, not display name).
 * - Staging inventory today: **sku-api** + **sku-postgres** only (Online). No n8n in staging yet.
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
 * Immutable Railway project ID for portable-sku-platform.
 * Display name can change; guard must not key off `projectName`.
 */
const SKU_PLATFORM_PROJECT_ID = "6d7d5885-43eb-4283-b4a4-e552fc6dba7b";

/** Current display name (docs / `project()` only — not the apply guard). */
const SKU_PLATFORM_PROJECT_NAME = "portable-sku-platform";

export default defineRailway((ctx) => {
  if (!ctx.isEnvironment("staging")) {
    throw new Error(
      `Refusing to manage ${ctx.projectName ?? "?"}/${ctx.environmentName}: staging only. Production is out of scope for this partial.`,
    );
  }

  if (ctx.projectName === "synarava-shop") {
    throw new Error(
      "Refusing synarava-shop: do not create sku-api/sku-postgres/n8n duplicates next to the storefront. Synarava calls the SKU API over HTTPS.",
    );
  }

  if (!ctx.projectId) {
    throw new Error(
      "Refusing: Railway context missing projectId. IaC guard requires immutable project identity.",
    );
  }

  if (ctx.projectId !== SKU_PLATFORM_PROJECT_ID) {
    throw new Error(
      `Refusing projectId=${ctx.projectId} (${ctx.projectName ?? "?"}): expected ${SKU_PLATFORM_PROJECT_ID} (${SKU_PLATFORM_PROJECT_NAME}).`,
    );
  }

  // Existing staging data plane — IaC adopts; does not invent Postgres or n8n.
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

  // Staging has no n8n yet — do not create it in this partial.
  // Production may host sku-platform-n8n (+ postgres); out of scope for apply.

  return project(SKU_PLATFORM_PROJECT_NAME, {
    resources: [skuPostgres, skuApi],
  });
});
