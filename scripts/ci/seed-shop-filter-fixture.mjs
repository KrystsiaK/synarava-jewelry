/**
 * CI-only seed: minimal ACTIVE/PUBLIC products with distinct productType values
 * so Storefront smoke can exercise catalog filter-cache ownership (tile count
 * strictly below shop total).
 *
 * Hard refuse unless CI=true AND DATABASE_URL host is localhost / 127.0.0.1 / postgres.
 * Never point this at prod, staging, or any remote host.
 *
 * Prisma is loaded only after the safety gate passes.
 * Invoke with `node scripts/ci/seed-shop-filter-fixture.mjs` (no shebang — Vitest/Vite
 * SSR-transform breaks on `#!/usr/bin/env node` when this module is imported by tests).
 */
import { pathToFileURL } from "node:url";

/** Disposable CI / local loopback hosts only. */
export const ALLOWED_DB_HOSTS = new Set(["localhost", "127.0.0.1", "postgres"]);

/** 3 Ring + 2 Earrings + 1 Bracelet → Bracelet tile (1) < total (6). */
export const FIXTURE_PRODUCTS = [
  { productType: "Ring", slug: "ci-filter-ring-1", sku: "CI-FILTER-RING-1", name: "CI Filter Ring 1" },
  { productType: "Ring", slug: "ci-filter-ring-2", sku: "CI-FILTER-RING-2", name: "CI Filter Ring 2" },
  { productType: "Ring", slug: "ci-filter-ring-3", sku: "CI-FILTER-RING-3", name: "CI Filter Ring 3" },
  { productType: "Earrings", slug: "ci-filter-earrings-1", sku: "CI-FILTER-EAR-1", name: "CI Filter Earrings 1" },
  { productType: "Earrings", slug: "ci-filter-earrings-2", sku: "CI-FILTER-EAR-2", name: "CI Filter Earrings 2" },
  { productType: "Bracelet", slug: "ci-filter-bracelet-1", sku: "CI-FILTER-BRAC-1", name: "CI Filter Bracelet 1" },
];

/**
 * @param {string | undefined} databaseUrl
 * @returns {string | null} hostname, or null if unparseable / missing
 */
export function databaseUrlHost(databaseUrl) {
  if (!databaseUrl) return null;
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return null;
  }
}

/**
 * @param {{ ci?: string | undefined, databaseUrl?: string | undefined }} env
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function assertSafeCiSeedEnv(env) {
  if (env.ci !== "true") {
    return { ok: false, reason: "refusing: CI must be exactly \"true\"" };
  }
  const host = databaseUrlHost(env.databaseUrl);
  if (!host || !ALLOWED_DB_HOSTS.has(host)) {
    return {
      ok: false,
      reason: `refusing: DATABASE_URL host must be exactly localhost, 127.0.0.1, or postgres (got ${host ?? "missing/unparseable"})`,
    };
  }
  return { ok: true };
}

/** @param {object} prisma PrismaClient instance */
async function seed(prisma) {
  const publishedAt = new Date();
  for (const row of FIXTURE_PRODUCTS) {
    await prisma.product.upsert({
      where: { slug: row.slug },
      create: {
        slug: row.slug,
        sku: row.sku,
        name: row.name,
        priceCents: 10000,
        status: "ACTIVE",
        visibility: "PUBLIC",
        productType: row.productType,
        publishedAt,
        currency: "EUR",
      },
      update: {
        sku: row.sku,
        name: row.name,
        priceCents: 10000,
        status: "ACTIVE",
        visibility: "PUBLIC",
        productType: row.productType,
        publishedAt,
      },
    });
  }
  return FIXTURE_PRODUCTS.length;
}

async function main() {
  const gate = assertSafeCiSeedEnv({
    ci: process.env.CI,
    databaseUrl: process.env.DATABASE_URL,
  });
  if (!gate.ok) {
    console.error(`seed-shop-filter-fixture: ${gate.reason}`);
    process.exit(1);
  }

  // Runtime-only resolve so the CI/host gate can refuse before Prisma loads.
  const prismaModuleId = "@prisma/client";
  const { PrismaClient } = await import(prismaModuleId);
  const prisma = new PrismaClient();
  try {
    const count = await seed(prisma);
    console.log(`seed-shop-filter-fixture: upserted ${count} ACTIVE/PUBLIC products (Ring×3, Earrings×2, Bracelet×1)`);
  } finally {
    await prisma.$disconnect();
  }
}

const isDirectRun = Boolean(process.argv[1])
  && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error("seed-shop-filter-fixture: failed", error);
    process.exit(1);
  });
}
