import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(rel: string) {
  return readFileSync(join(root, rel), "utf8");
}

describe("destructive collection delete archives first (PR-8)", () => {
  it("deleteLocalCollection routes through archiveAndDeleteCollection", () => {
    const source = read("lib/shopify/collection-presence-server.ts");
    expect(source).toMatch(/async function deleteLocalCollection/);
    expect(source).toMatch(/archiveAndDeleteCollection/);
    expect(source).not.toMatch(/tx\.collection\.delete\(\s*\{\s*where:\s*\{\s*id:\s*collectionId/);
  });

  it("migration is additive CREATE TABLE only", () => {
    const sql = read("prisma/migrations/20261027123000_sync_entity_archive/migration.sql");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS "SyncEntityArchive"/);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(sql).not.toMatch(/\bALTER TABLE\b/i);
  });

  it("restore SQL is documented under scripts/db", () => {
    const sql = read("scripts/db/restore-entity-archive.sql");
    expect(sql).toMatch(/SyncEntityArchive/);
    expect(sql).toMatch(/restore/i);
  });
});
