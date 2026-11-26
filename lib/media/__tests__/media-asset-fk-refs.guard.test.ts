import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MEDIA_ASSET_FK_REF_FIELDS } from "@/lib/media/media-asset-fk-refs";

const root = join(process.cwd());

function mediaAssetRelationNames(schema: string): string[] {
  const start = schema.indexOf("model MediaAsset");
  expect(start).toBeGreaterThanOrEqual(0);
  const body = schema.slice(start);
  const end = body.indexOf("\nmodel ");
  const block = end > 0 ? body.slice(0, end) : body;
  return [...block.matchAll(/@relation\("([^"]+)"\)/g)].map((match) => match[1]);
}

describe("MediaAsset FK ref coverage", () => {
  it("lists every MediaAsset relation from schema.prisma", () => {
    const schema = readFileSync(join(root, "prisma/schema.prisma"), "utf8");
    const relations = mediaAssetRelationNames(schema).sort();
    const listed = MEDIA_ASSET_FK_REF_FIELDS.map((row) => row.relation).sort();
    expect(listed).toEqual(relations);
  });

  it("infrastructure audit + cleanup count every listed FK field", () => {
    const audit = readFileSync(join(root, "scripts/audit/infrastructure-audit.mjs"), "utf8");
    const cleanup = readFileSync(join(root, "scripts/audit/infrastructure-cleanup.mjs"), "utf8");
    for (const row of MEDIA_ASSET_FK_REF_FIELDS) {
      expect(audit, `audit missing ${row.field}`).toContain(row.field);
      expect(cleanup, `cleanup missing ${row.field}`).toContain(row.field);
    }
  });
});
