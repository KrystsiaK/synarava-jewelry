/**
 * Railway Infrastructure as Code (GA) — portable SKU platform slice.
 *
 * Project `portable-sku-platform` (immutable ID below):
 * - **staging:** sku-api + sku-postgres (adopt) + n8n + n8n-postgres + n8n-data-v2
 * - **production:** adopt existing sku-platform-n8n* + volumes; **create only**
 *   isolated sku-api + sku-postgres
 *
 * Guards: project ID + (production) environment ID. Never synarava-shop.
 * Synarava web stays in `synarava-shop` (HTTPS client).
 *
 * **Do not `railway config apply` until Business Owner + Kiryl explicit go**
 * after a green `config plan` (see runbooks).
 *
 * Docs:
 * - https://docs.railway.com/infrastructure-as-code
 * - https://docs.railway.com/deployments/monorepo
 * - https://docs.railway.com/guides/n8n
 * - docs/runbooks/portable-sku-platform-railway.md
 * - docs/runbooks/portable-sku-platform-production.md
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
export const SKU_PLATFORM_PROJECT_ID =
  "6d7d5885-43eb-4283-b4a4-e552fc6dba7b";

/** Current display name (docs / `project()` only — not the apply guard). */
export const SKU_PLATFORM_PROJECT_NAME = "portable-sku-platform";

/**
 * Immutable production environment ID.
 * Display name `production` alone is insufficient for Stage 6 apply.
 */
export const SKU_PLATFORM_PRODUCTION_ENV_ID =
  "d8cb7dd8-5c26-4255-a8c5-7795f1993de6";

/** Live production service IDs (docs / plan-gate identity — adopt by name). */
export const PROD_N8N_SERVICE_ID = "04d32fed-eae9-4219-8ebb-cc6cbc403c37";
export const PROD_N8N_POSTGRES_SERVICE_ID =
  "e7f8a122-dfb5-498e-8002-23fb0f50e3ca";

/**
 * Production n8n volume resource name — exact live name (Kiryl).
 * Plan must show adopt (no create/delete/replace). Never invent a new volume.
 */
export const PROD_N8N_VOLUME_NAME = "sku-platform-n8n-volume";

/**
 * Existing production Postgres volume name (attached to sku-platform-n8n-postgres).
 * Plan gate forbids create/delete/replace of this volume.
 */
export const PROD_N8N_POSTGRES_VOLUME_NAME = "postgres-volume";

/** Staging n8n image pin (deliberate; bump only after staging verify). */
export const STAGING_N8N_IMAGE = "n8nio/n8n:2.44.1";

/**
 * Production n8n image pin — exact live tag. Stage 6 adopt must NOT upgrade.
 * Do not share STAGING_N8N_IMAGE with production.
 */
export const PROD_N8N_IMAGE = "n8nio/n8n:2.42.7";

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

/**
 * Production sku-api deploys only from protected `main`.
 * Before any production plan/apply, the plan-check proves that origin/main
 * contains the complete origin/staging history merged through PR #148.
 */
export const PROD_SKU_API_GITHUB_BRANCH = "main";

function assertSkuPlatformProject(ctx: {
  projectId?: string;
  projectName?: string;
}): void {
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
}

function buildSkuApi(opts: {
  readonly githubBranch: string;
  readonly skuPostgres: ReturnType<typeof postgres>;
}) {
  const { githubBranch, skuPostgres } = opts;
  return service("sku-api", {
    source: github("KrystsiaK/synarava-jewelry", {
      branch: githubBranch,
      checkSuites: true,
    }),
    build: {
      buildCommand:
        "pnpm --filter @synarava/sku-api prisma:generate && pnpm --filter @synarava/sku-api build",
      watchPatterns: [...SKU_API_WATCH_PATTERNS],
    },
    preDeploy: "pnpm --filter @synarava/sku-api prisma:deploy",
    start: "pnpm --filter @synarava/sku-api start",
    healthcheck: "/health",
    healthcheckTimeout: 30,
    env: {
      PORT: "8080",
      SKU_DATABASE_URL: skuPostgres.env.DATABASE_URL,
      SKU_API_CREDENTIALS: preserve(),
      SKU_API_PRE_AUTH_RATE_LIMIT_PER_MIN: preserve(),
      SKU_API_RATE_LIMIT_PER_MIN: preserve(),
    },
  });
}

function buildStagingResources() {
  const skuPostgres = postgres("sku-postgres");
  const skuApi = buildSkuApi({
    githubBranch: "staging",
    skuPostgres,
  });

  const n8nPostgres = postgres("n8n-postgres");
  // `n8n-data` is pending Railway's 48-hour deletion retention after the
  // empty staging reset. Use a new stable resource name instead of restoring
  // the incompatible encryption-key metadata from that volume.
  const n8nData = volume("n8n-data-v2", {
    region: "europe-west4-drams3a",
    sizeMB: 1024,
  });

  const n8n = service("n8n", {
    source: image(STAGING_N8N_IMAGE, {
      autoUpdates: { type: "disabled" },
    }),
    volumeMounts: {
      "/home/node/.n8n": n8nData,
    },
    env: {
      RAILWAY_RUN_UID: "0",
      N8N_USER_FOLDER: "/home/node",
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
      N8N_BLOCK_ENV_ACCESS_IN_NODE: "false",
      SKU_API_URL: "http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080",
      SKU_API_TOKEN: preserve(),
      SKU_API_WORKSPACE: "synarava-shop",
      // Legacy value is unused by the live-Shopify workflow; preserve it until
      // post-deploy cleanup so an unrelated IaC apply never deletes runtime state.
      CATALOG_ITEMS_JSON: preserve(),
      TELEGRAM_CHAT_ID: preserve(),
    },
  });

  return [skuPostgres, skuApi, n8nPostgres, n8nData, n8n] as const;
}

/**
 * Production desired state.
 *
 * Expected plan: **create** `sku-api` + `sku-postgres` only.
 * Adopt (zero create/delete/replace): `sku-platform-n8n`,
 * `sku-platform-n8n-postgres`, and volume `PROD_N8N_VOLUME_NAME`.
 * Allowed non-structural updates: env wiring (e.g. SKU_API_URL → new sku-api).
 * Forbidden: image/version bump without documented justification; volume create/delete/replace.
 */
function buildProductionResources() {
  // NEW — isolated production data plane (only expected creates).
  const skuPostgres = postgres("sku-postgres");
  const skuApi = buildSkuApi({
    githubBranch: PROD_SKU_API_GITHUB_BRANCH,
    skuPostgres,
  });

  // ADOPT — existing production n8n Postgres (service ID documented above).
  const n8nPostgres = postgres("sku-platform-n8n-postgres");

  // ADOPT — existing volume (name must match pull; never create anew).
  const n8nData = volume(PROD_N8N_VOLUME_NAME, {
    region: "europe-west4-drams3a",
    // Match the adopted live volume exactly. Never shrink production storage.
    sizeMB: 5000,
  });

  // ADOPT — existing production n8n (service ID documented above).
  // Pin PROD_N8N_IMAGE (live 2.42.7) — do NOT upgrade to staging's 2.44.1.
  const n8n = service("sku-platform-n8n", {
    source: image(PROD_N8N_IMAGE),
    volumeMounts: {
      "/home/node/.n8n": n8nData,
    },
    env: {
      RAILWAY_RUN_UID: "0",
      N8N_USER_FOLDER: "/home/node",
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
      N8N_BLOCK_ENV_ACCESS_IN_NODE: "false",
      // Preserve existing production runtime hardening/runner settings.
      N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS: preserve(),
      N8N_PROXY_HOPS: preserve(),
      N8N_RUNNERS_ENABLED: preserve(),
      TZ: preserve(),
      // Wire to NEW production sku-api (allowed env update; not create/replace).
      SKU_API_URL: "http://${{sku-api.RAILWAY_PRIVATE_DOMAIN}}:8080",
      SKU_API_TOKEN: preserve(),
      SKU_API_WORKSPACE: "synarava-shop",
      // Unused compatibility value; remove manually only after workflow verification.
      CATALOG_ITEMS_JSON: preserve(),
      // Shared Synarava Ops channel — chat ID sealed; bot token in n8n credential only.
      TELEGRAM_CHAT_ID: preserve(),
    },
  });

  return [skuPostgres, skuApi, n8nPostgres, n8nData, n8n] as const;
}

export default defineRailway((ctx) => {
  assertSkuPlatformProject(ctx);

  if (ctx.isEnvironment("staging")) {
    return project(SKU_PLATFORM_PROJECT_NAME, {
      resources: [...buildStagingResources()],
    });
  }

  if (ctx.isEnvironment("production")) {
    if (!ctx.environmentId) {
      throw new Error(
        "Refusing production: Railway context missing environmentId. Stage 6 guard requires immutable production environment identity.",
      );
    }
    if (ctx.environmentId !== SKU_PLATFORM_PRODUCTION_ENV_ID) {
      throw new Error(
        `Refusing production environmentId=${ctx.environmentId}: expected ${SKU_PLATFORM_PRODUCTION_ENV_ID}.`,
      );
    }
    return project(SKU_PLATFORM_PROJECT_NAME, {
      resources: [...buildProductionResources()],
    });
  }

  throw new Error(
    `Refusing to manage ${ctx.projectName ?? "?"}/${ctx.environmentName ?? "?"}: staging or production only (project ${SKU_PLATFORM_PROJECT_ID}).`,
  );
});
