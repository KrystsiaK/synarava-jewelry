import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Local / CI SQL contract for migrating ProductPairing.imageAssetId → ProductPairingImage.
 * Does not touch production DBs. Full migrate deploy runs in CI against synarava_ci.
 */
describe("product pairing images migration", () => {
  it("creates ProductPairingImage, copies old photos, then drops imageAssetId", async () => {
    const migrationPath = path.join(
      process.cwd(),
      "prisma/migrations/20261126141214_product_pairing_images/migration.sql",
    );
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toMatch(/CREATE TABLE "ProductPairingImage"/);
    expect(sql).toMatch(/INSERT INTO "ProductPairingImage"/);
    expect(sql).toMatch(/FROM "ProductPairing"/);
    expect(sql).toMatch(/WHERE "imageAssetId" IS NOT NULL/);
    expect(sql).toMatch(/DROP CONSTRAINT "ProductPairing_imageAssetId_fkey"/);
    expect(sql).toMatch(/DROP COLUMN "imageAssetId"/);
    // Never edit the original pairing migration.
    expect(migrationPath).not.toContain("20261125223914_product_pairing");
  });
});
