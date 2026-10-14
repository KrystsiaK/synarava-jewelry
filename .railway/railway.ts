/**
 * Railway Infrastructure as Code (GA) — portable SKU platform slice (staging).
 *
 * Target `portable-sku-platform` / staging:
 * - sku-api + sku-postgres (adopt existing)
 * - staging n8n + separate n8n-postgres + n8n-data volume
 *
 * Guard: immutable project ID `6d7d5885-43eb-4283-b4a4-e552fc6dba7b` (not display name).
 * Staging only. Never touch production (including prod `sku-platform-n8n*`).
 * Synarava web stays in `synarava-shop` (HTTPS client — no sku duplicates there).
 *
 * **Do not `railway config apply` until Kiryl confirms** after `config plan`
 * (see adoption gate in docs/runbooks/portable-sku-platform-railway.md).
 *
 * Docs:
 * - https://docs.railway.com/infrastructure-as-code
 * - https://docs.railway.com/deployments/monorepo
 * - https://docs.railway.com/guides/n8n
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

/** Named partial — owns SKU platform resources only (never synarava-web). */
export const partial = "sku";

/**
 * Immutable Railway project ID for portable-sku-platform.
 * Display name can change; guard must not key off `projectName`.
 */
const SKU_PLATFORM_PROJECT_ID = "6d7d5885-43eb-4283-b4a4-e552fc6dba7b";

/** Current display name (docs / `project()` only — not the apply guard). */
const SKU_PLATFORM_PROJECT_NAME = "portable-sku-platform";

/** Pin n8n image; bump deliberately after staging verify. */
const N8N_IMAGE = "n8nio/n8n:2.44.1";

/**
 * Exact live staging sku-api watch paths (must stay in IaC).
 * String `build: "…"` only sets buildCommand and would clear these on plan.
 * Do not add `/.railway/**` — live sku-api does not have it (would be an unwanted change).
 */
export const SKU_API_WATCH_PATTERNS = [
  "/services/sku-api/**",
  "/packages/sku-core/**",
  "/packages/sku-contract/**",
  "/pnpm-lock.yaml",
  "/pnpm-workspace.yaml",
  "/package.json",
] as const;

export default defineRailway((ctx) => {
  if (!ctx.isEnvironment("staging")) {
    throw new Error(
      `Refusing to manage ${ctx.projectName ?? "?"}/${ctx.environmentName}: staging only. Production (including sku-platform-n8n*) is out of scope.`,
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

  // Existing staging data plane — IaC adopts; apply gate forbids recreate/delete.
  const skuPostgres = postgres("sku-postgres");

  // Adopt existing staging sku-api settings that string-build / default github()
  // would otherwise clear on plan (Kiryl plan: 3 add + 2 unwanted changes).
  // https://docs.railway.com/infrastructure-as-code
  // https://docs.railway.com/deployments/monorepo
  const skuApi = service("sku-api", {
    source: github("KrystsiaK/synarava-jewelry", {
      branch: "staging",
      // Wait for GitHub check suites before deploy (live staging has true).
      checkSuites: true,
    }),
    build: {
      buildCommand:
        "pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build",
      // Dashboard watch paths — must be explicit; string `build` only sets buildCommand.
      watchPatterns: [...SKU_API_WATCH_PATTERNS],
    },
    preDeploy: "pnpm --filter @synarava/sku-api prisma:deploy",
    start: "pnpm --filter @synarava/sku-api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      SKU_DATABASE_URL: skuPostgres.env.DATABASE_URL,
      SKU_API_CREDENTIALS: preserve(),
      // Pre-auth (workspace+IP) then post-auth (credential fingerprint).
      SKU_API_PRE_AUTH_RATE_LIMIT_PER_MIN: preserve(),
      SKU_API_RATE_LIMIT_PER_MIN: preserve(),
    },
  });

  // Staging n8n — separate Postgres from sku-postgres; volume for encryption keys/local files.
  // https://docs.railway.com/guides/n8n (Optional: Use Postgres instead of SQLite)
  const n8nPostgres = postgres("n8n-postgres");
  const n8nData = volume("n8n-data", { sizeMB: 1024 });

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
      DB_TYPE: "postgresdb",
      DB_POSTGRESDB_HOST: n8nPostgres.env.PGHOST,
      DB_POSTGRESDB_PORT: n8nPostgres.env.PGPORT,
      DB_POSTGRESDB_DATABASE: n8nPostgres.env.PGDATABASE,
      DB_POSTGRESDB_USER: n8nPostgres.env.PGUSER,
      DB_POSTGRESDB_PASSWORD: n8nPostgres.env.PGPASSWORD,
      // Same-project private URL to sku-api (not synarava-shop; not prod n8n).
      SKU_API_URL:
        "http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:${{sku-api.PORT}}",
      SKU_API_TOKEN: preserve(),
      SKU_API_WORKSPACE: "synarava-shop",
      CATALOG_ITEMS_JSON: preserve(),
      NOTIFY_WEBHOOK_URL: preserve(),
    },
  });

  return project(SKU_PLATFORM_PROJECT_NAME, {
    resources: [skuPostgres, skuApi, n8nPostgres, n8nData, n8n],
  });
});
