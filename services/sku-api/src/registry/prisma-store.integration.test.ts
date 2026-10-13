/**
 * Real PostgreSQL integration: migrate → bootstrap profile → reserve →
 * disconnect → reconnect → assert persistence.
 *
 * Requires SKU_DATABASE_URL (defaults to local sku_test for agent/dev).
 * Skipped when SKU_SKIP_PG_INTEGRATION=1.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "../generated/prisma/index.js";
import { bootstrapSynaravaShopWorkspace } from "../bootstrap.js";
import { createPrismaSkuRegistryStore } from "./prisma-store.js";

const skip = process.env.SKU_SKIP_PG_INTEGRATION === "1";
const databaseUrl =
  process.env.SKU_DATABASE_URL?.trim() ||
  "postgresql://sku:sku@127.0.0.1:5432/sku_test";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);

describe.skipIf(skip)("Prisma SkuRegistryStore (PostgreSQL)", () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    execFileSync(
      "pnpm",
      ["exec", "prisma", "migrate", "deploy"],
      {
        cwd: packageRoot,
        env: { ...process.env, SKU_DATABASE_URL: databaseUrl },
        stdio: "pipe",
      },
    );
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  it("persists workspace, profile, and reservation across reconnect", async () => {
    // Clean slate for this workspace key (integration isolation).
    const workspaceKey = "synarava-shop";
    await prisma.workspace.deleteMany({ where: { key: workspaceKey } });

    const storeA = createPrismaSkuRegistryStore(prisma);
    const bootstrap1 = await bootstrapSynaravaShopWorkspace(storeA, {
      workspaceKey,
    });
    expect(bootstrap1.action).toBe("created");
    expect(bootstrap1.publishedProfileVersion).toBe(1);

    const bootstrap2 = await bootstrapSynaravaShopWorkspace(storeA, {
      workspaceKey,
    });
    expect(bootstrap2.action).toBe("already-published");

    const reservation = await storeA.reserve({
      workspaceKey,
      familyKey: "jewelry.necklace",
      idempotencyKey: "pg-integration-reserve-1",
      correlationId: "pg-integration-corr-1",
      actor: "integration-test",
    });
    expect(reservation.sku).toBe("JW-NECK-001");
    expect(reservation.status).toBe("PENDING");
    const reservationId = reservation.id;

    await prisma.$disconnect();

    const prismaB = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
    const storeB = createPrismaSkuRegistryStore(prismaB);

    try {
      const published = await storeB.getPublishedProfile(workspaceKey);
      expect(published?.version).toBe(1);
      expect(published?.status).toBe("PUBLISHED");

      const reloaded = await storeB.getReservation(workspaceKey, reservationId);
      expect(reloaded).not.toBeNull();
      expect(reloaded?.sku).toBe("JW-NECK-001");
      expect(reloaded?.idempotencyKey).toBe("pg-integration-reserve-1");

      const again = await storeB.reserve({
        workspaceKey,
        familyKey: "jewelry.necklace",
        idempotencyKey: "pg-integration-reserve-1",
        correlationId: "pg-integration-corr-1",
        actor: "integration-test",
      });
      expect(again.id).toBe(reservationId);

      const next = await storeB.reserve({
        workspaceKey,
        familyKey: "jewelry.necklace",
        idempotencyKey: "pg-integration-reserve-2",
        correlationId: "pg-integration-corr-2",
        actor: "integration-test",
      });
      expect(next.sku).toBe("JW-NECK-002");
    } finally {
      await prismaB.$disconnect();
    }

    // Re-bind suite client for afterAll.
    prisma = new PrismaClient({
      datasources: { db: { url: databaseUrl } },
    });
  }, 60_000);

  it("assigns unique sequential SKUs under parallel same-stem reserves", async () => {
    const workspaceKey = "synarava-shop-concurrency";
    await prisma.workspace.deleteMany({ where: { key: workspaceKey } });

    const store = createPrismaSkuRegistryStore(prisma);
    await bootstrapSynaravaShopWorkspace(store, { workspaceKey });

    const parallel = 12;
    const results = await Promise.all(
      Array.from({ length: parallel }, (_, index) =>
        store.reserve({
          workspaceKey,
          familyKey: "jewelry.necklace",
          idempotencyKey: `pg-concurrency-${index}`,
          correlationId: `pg-concurrency-corr-${index}`,
          actor: "concurrency-test",
        }),
      ),
    );

    const skus = results.map((r) => r.sku).toSorted();
    expect(new Set(skus).size).toBe(parallel);
    expect(skus).toEqual(
      Array.from({ length: parallel }, (_, i) =>
        `JW-NECK-${String(i + 1).padStart(3, "0")}`,
      ),
    );

    const sequences = results.map((r) => r.sequence).toSorted((a, b) => a - b);
    expect(sequences).toEqual(
      Array.from({ length: parallel }, (_, i) => i + 1),
    );
  }, 60_000);

  it("returns the same reservation for concurrent identical idempotency keys", async () => {
    const workspaceKey = "synarava-shop-idempotency-race";
    await prisma.workspace.deleteMany({ where: { key: workspaceKey } });

    const store = createPrismaSkuRegistryStore(prisma);
    await bootstrapSynaravaShopWorkspace(store, { workspaceKey });

    const key = "pg-idempotency-race-shared";
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        store.reserve({
          workspaceKey,
          familyKey: "jewelry.bracelet",
          idempotencyKey: key,
          correlationId: `pg-idem-corr-${index}`,
          actor: "concurrency-test",
        }),
      ),
    );

    const ids = new Set(results.map((r) => r.id));
    const skus = new Set(results.map((r) => r.sku));
    expect(ids.size).toBe(1);
    expect(skus.size).toBe(1);
    expect(results[0]?.sku).toBe("JW-BRACELET-001");
  }, 60_000);
});
