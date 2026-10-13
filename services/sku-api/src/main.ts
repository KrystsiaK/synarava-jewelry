import { createCredential, parseCredentialsEnv } from "./auth.js";
import { bootstrapSynaravaShopWorkspace } from "./bootstrap.js";
import { createSkuHttpServer } from "./http/server.js";
import { createSkuStoreRuntime } from "./registry/create-store.js";

const port = Number(process.env.PORT ?? process.env.SKU_API_PORT ?? 8787);
const host = process.env.SKU_API_HOST ?? "0.0.0.0";

async function main() {
  const runtime = createSkuStoreRuntime();
  const { store } = runtime;

  let credentials = parseCredentialsEnv(process.env.SKU_API_CREDENTIALS);
  if (credentials.length === 0 && process.env.SKU_API_DEV_TOKEN) {
    const workspaceKey = process.env.SKU_API_DEV_WORKSPACE ?? "synarava-shop";
    const created = createCredential(workspaceKey, process.env.SKU_API_DEV_TOKEN);
    credentials = [created];
    console.info(
      JSON.stringify({
        level: "warn",
        message:
          "Using SKU_API_DEV_TOKEN (dev only). Set SKU_API_CREDENTIALS with salted hashes for staging/production.",
        workspaceKey,
      }),
    );
  }

  // Idempotent workspace + published profile. Never use SKU_SEED_EXAMPLE in staging/prod.
  // Opt out with SKU_BOOTSTRAP=0 for empty local runs.
  const bootstrapDisabled = process.env.SKU_BOOTSTRAP === "0";
  if (!bootstrapDisabled) {
    const bootstrap = await bootstrapSynaravaShopWorkspace(store);
    console.info(
      JSON.stringify({
        level: "info",
        message: "bootstrap",
        ...bootstrap,
      }),
    );
  }

  let dbReady = runtime.mode === "memory";
  if (runtime.mode === "postgres") {
    dbReady = await runtime.ready();
    if (!dbReady) {
      console.error(
        JSON.stringify({
          level: "error",
          message: "SKU_DATABASE_URL set but database not reachable",
        }),
      );
    }
  }

  const credentialsReady = credentials.length > 0;
  const server = createSkuHttpServer({
    store,
    credentials,
    ready: () => credentialsReady && dbReady,
    mode: runtime.mode,
  });

  const shutdown = async () => {
    await runtime.disconnect();
    process.exit(0);
  };
  process.on("SIGTERM", () => {
    void shutdown();
  });
  process.on("SIGINT", () => {
    void shutdown();
  });

  server.listen(port, host, () => {
    console.info(
      JSON.stringify({
        service: "@synarava/sku-api",
        stage: "http-v1",
        host,
        port,
        store: runtime.mode,
        ready: credentialsReady && dbReady,
      }),
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
