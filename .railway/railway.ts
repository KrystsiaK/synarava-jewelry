/**
 * Railway Infrastructure as Code (GA) — sku slice (staging only).
 *
 * Config as Code (`railway.json` / `railway.toml`) is deprecated for new services
 * and overrides dashboard settings. This partial manages sku-api + sku-postgres
 * + staging n8n (Этап 5 Slice B) without touching the existing synarava-web
 * legacy CaC path.
 *
 * Docs:
 * - https://docs.railway.com/infrastructure-as-code
 * - https://docs.railway.com/infrastructure-as-code/reference
 * - https://docs.railway.com/deployments/monorepo
 * - https://docs.railway.com/guides/n8n
 *
 * Apply (staging):
 *   railway link   # project + staging environment
 *   railway config plan
 *   railway config apply
 *
 * Web deploy stays on: deploy/railway.synarava-web.json (legacy CaC until migrated).
 * n8n workflow import: deploy/n8n/sku-catalog-audit.workflow.json
 * Runbook: docs/runbooks/sku-catalog-audit-staging.md
 */
import {
  defineRailway,
  github,
  image,
  postgres,
  preserve,
  project,
  service,
  volume,
} from "railway/iac";

/** Named partial so apply only owns sku resources (does not delete web). */
export const partial = "sku";

/** Pin n8n image; bump deliberately after staging verify. */
const N8N_IMAGE = "n8nio/n8n:2.44.1";

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

  const n8nData = volume("n8n-data", { sizeMB: 1024 });

  // Staging-only automation host. Secrets via preserve(); public domain + WEBHOOK_URL
  // completed in dashboard after first deploy (see runbook).
  const n8n = service("n8n", {
    source: image(N8N_IMAGE, {
      autoUpdates: { type: "disabled" },
    }),
    volumeMounts: {
      "/home/node/.n8n": n8nData,
    },
    env: {
      N8N_PORT: "${{PORT}}",
      N8N_HOST: "0.0.0.0",
      N8N_PROTOCOL: "https",
      N8N_EDITOR_BASE_URL: preserve(),
      WEBHOOK_URL: preserve(),
      N8N_BASIC_AUTH_ACTIVE: "true",
      N8N_BASIC_AUTH_USER: preserve(),
      N8N_BASIC_AUTH_PASSWORD: preserve(),
      N8N_ENCRYPTION_KEY: preserve(),
      GENERIC_TIMEZONE: "UTC",
      // Private Railway URL to sku-api in the same project/environment.
      SKU_API_URL:
        "http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}",
      SKU_API_TOKEN: preserve(),
      SKU_API_WORKSPACE: "synarava-shop",
      // JSON array of { externalVariantId, sku } — max 100. Staging catalog window.
      CATALOG_ITEMS_JSON: preserve(),
      // HTTP POST sink; required only when shouldNotify becomes true.
      NOTIFY_WEBHOOK_URL: preserve(),
    },
  });

  return project(ctx.projectName, {
    resources: [skuPostgres, skuApi, n8nData, n8n],
  });
});
