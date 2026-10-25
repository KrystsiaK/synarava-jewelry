import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Audit #8: additive migration closes duplicate active rows then creates a
 * partial unique index so only one QUEUED/RUNNING reconcile run can exist.
 */

describe("one active catalog reconcile run migration", () => {
  it("marks duplicate active rows FAILED then creates the partial unique index", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261025140000_one_active_catalog_reconcile_run/migration.sql",
    );
    const sql = await readFile(migrationPath, "utf8");
    expect(sql).toMatch(/ROW_NUMBER/);
    expect(sql).toMatch(/FAILED/);
    expect(sql).toMatch(/CREATE UNIQUE INDEX "ShopifyReconcileRun_one_active_idx"/);
    expect(sql).toMatch(/WHERE "status" IN \('QUEUED', 'RUNNING'\)/);
    expect(sql).toMatch(/\(true\)/);
  });
});
