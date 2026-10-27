import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * STRUCTURAL: Admin API 2026-07 forbids collectionUpdate(input:).
 * Exactly one production mutation string may call collectionUpdate(collection:).
 */

const root = process.cwd();
const HELPER = "lib/shopify/collection-update.ts";
const INLINE = "collectionUpdate(collection:";
const LEGACY = "collectionUpdate(input:";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "__tests__") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

describe("collectionUpdate API shape guard", () => {
  it("forbids legacy input: and a second inline collectionUpdate mutation under lib/ and app/", () => {
    const files = [...walk(join(root, "lib")), ...walk(join(root, "app"))];
    const legacyHits: string[] = [];
    const inlineHosts: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const rel = relative(root, file);
      if (src.includes(LEGACY)) legacyHits.push(rel);
      if (src.includes(INLINE)) inlineHosts.push(rel);
    }

    expect(legacyHits, `legacy collectionUpdate(input:) in: ${legacyHits.join(", ")}`).toEqual([]);
    expect(inlineHosts).toEqual([HELPER]);
  });
});
