import { PrismaClient } from "../generated/prisma/index.js";
import { createMemorySkuRegistryStore } from "./memory-store.js";
import { createPrismaSkuRegistryStore } from "./prisma-store.js";
import type { SkuRegistryStore } from "./types.js";

export type SkuStoreRuntime = {
  readonly store: SkuRegistryStore;
  readonly mode: "postgres" | "memory";
  readonly prisma: PrismaClient | null;
  readonly ready: () => Promise<boolean>;
  readonly disconnect: () => Promise<void>;
};

/**
 * Postgres when SKU_DATABASE_URL is set; otherwise in-memory (tests / local without DB).
 */
export function createSkuStoreRuntime(): SkuStoreRuntime {
  const databaseUrl = process.env.SKU_DATABASE_URL?.trim();
  if (databaseUrl) {
    const prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    return {
      store: createPrismaSkuRegistryStore(prisma),
      mode: "postgres",
      prisma,
      async ready() {
        try {
          await prisma.$queryRaw`SELECT 1`;
          return true;
        } catch {
          return false;
        }
      },
      async disconnect() {
        await prisma.$disconnect();
      },
    };
  }

  const store = createMemorySkuRegistryStore();
  return {
    store,
    mode: "memory",
    prisma: null,
    async ready() {
      return true;
    },
    async disconnect() {
      /* no-op */
    },
  };
}
