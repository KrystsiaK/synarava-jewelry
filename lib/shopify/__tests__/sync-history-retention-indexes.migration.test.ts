import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guard: retention indexes match the real queries in reconciliation-run.ts.
 */

const migrationSql = readFileSync(
  join(
    process.cwd(),
    "prisma/migrations/20261025233000_sync_history_retention_indexes/migration.sql",
  ),
  "utf8",
);

const reconciliationRun = readFileSync(
  join(process.cwd(), "lib/shopify/reconciliation-run.ts"),
  "utf8",
);

describe("sync history retention indexes migration", () => {
  it("adds createdAt index for getLatestReconcileRun ordering", () => {
    expect(reconciliationRun).toMatch(/ORDER BY "createdAt" DESC/);
    expect(migrationSql).toContain('CREATE INDEX "ShopifyReconcileRun_createdAt_idx"');
    expect(migrationSql).toContain('ON "ShopifyReconcileRun"("createdAt")');
  });

  it("adds partial open-divergence index matching ROW_NUMBER partition", () => {
    expect(reconciliationRun).toMatch(/ROW_NUMBER\(\) OVER \(/);
    expect(reconciliationRun).toMatch(/PARTITION BY "bindingId", "locale", "fieldKey"/);
    expect(reconciliationRun).toMatch(/ORDER BY "createdAt" DESC/);
    expect(reconciliationRun).toMatch(/WHERE "resolvedAt" IS NULL/);

    expect(migrationSql).toContain('CREATE INDEX "ShopifyFieldDivergence_open_partition_idx"');
    expect(migrationSql).toMatch(
      /ON "ShopifyFieldDivergence" \("bindingId", "locale", "fieldKey", "createdAt" DESC\)/,
    );
    expect(migrationSql).toMatch(/WHERE "resolvedAt" IS NULL/);
  });

  it("does not drop indexes or tables", () => {
    expect(migrationSql).not.toMatch(/DROP /i);
  });
});
