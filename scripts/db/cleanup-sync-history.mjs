#!/usr/bin/env node
/**
 * One-shot drain of sync audit retention (90 days).
 * Prefer opportunistic cleanup via runCatalogConflictCheck; use this when
 * tables need a full catch-up (this deployment has no app cron).
 *
 * Usage (DATABASE_URL must already be set in the environment):
 *   node --import tsx scripts/db/cleanup-sync-history.mjs
 */
import { pathToFileURL } from "node:url";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("cleanup-sync-history: DATABASE_URL is required");
    process.exit(1);
  }

  const { cleanupSyncHistory } = await import("../../lib/shopify/sync-history-retention.ts");
  const stats = await cleanupSyncHistory({ maxBatches: 10_000 });
  console.log(JSON.stringify(stats, null, 2));

  try {
    const { db } = await import("../../lib/db.ts");
    await db.$disconnect();
  } catch {
    // ignore disconnect errors
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
