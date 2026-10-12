import { createCredential, parseCredentialsEnv } from "./auth.js";
import { createSkuHttpServer, seedExampleWorkspace } from "./http/server.js";
import { createMemorySkuRegistryStore } from "./registry/memory-store.js";

const port = Number(process.env.PORT ?? process.env.SKU_API_PORT ?? 8787);
const host = process.env.SKU_API_HOST ?? "0.0.0.0";

async function main() {
  const store = createMemorySkuRegistryStore();
  // Postgres Prisma adapter arrives with SKU_DATABASE_URL wiring on Railway.
  // Memory store is the Этап 2 local/default runtime until that adapter lands.
  if (process.env.SKU_SEED_EXAMPLE === "1") {
    await seedExampleWorkspace(store);
  }

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

  const server = createSkuHttpServer({
    store,
    credentials,
    ready: () => credentials.length > 0,
  });

  server.listen(port, host, () => {
    console.info(
      JSON.stringify({
        service: "@synarava/sku-api",
        stage: "http-v1",
        host,
        port,
        ready: credentials.length > 0,
      }),
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
