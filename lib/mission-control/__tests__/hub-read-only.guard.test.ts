import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mission Control §0: hub request path is read-only.
 * Status table writes belong only to the collector worker (and status.ts definitions).
 */

const root = process.cwd();

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "__tests__") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.") && !name.includes(".stories.")) {
      out.push(full);
    }
  }
  return out;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const REQUEST_PATH_ROOTS = [
  "app/admin/(admin)/mission-control",
  "components/admin/mission-control",
  "lib/mission-control",
] as const;

const WRITE_ALLOW = new Set([
  "lib/mission-control/status.ts",
  "lib/mission-control/collector/run-once.ts",
  "lib/mission-control/collector/entry.ts",
  "lib/mission-control/collector/alerts.ts",
  "lib/mission-control/collector/drift.ts",
  "lib/mission-control/collector/telegram.ts",
]);

const WRITE_IMPORT = /writeService(Node|Flow)Status/;
const PRISMA_MUTATE =
  /\bdb\.[A-Za-z0-9_]+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\s*\(/;

describe("Mission Control hub read-only import guards", () => {
  const files = REQUEST_PATH_ROOTS.flatMap((dir) =>
    walk(join(root, dir)).map((file) => relative(root, file)),
  );

  it("lists request-path sources to scan", () => {
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain("lib/mission-control/live-snapshot.ts");
    expect(files).toContain("app/admin/(admin)/mission-control/page.tsx");
  });

  it("request path must not import writeServiceNodeStatus / writeServiceFlowStatus", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (WRITE_ALLOW.has(rel)) continue;
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      if (WRITE_IMPORT.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("request path must not call Prisma mutate helpers (create/update/upsert/delete)", () => {
    const offenders: string[] = [];
    for (const rel of files) {
      if (WRITE_ALLOW.has(rel) || rel === "lib/mission-control/status.ts") continue;
      if (rel.startsWith("lib/mission-control/collector/")) continue;
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      if (PRISMA_MUTATE.test(source)) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });

  it("live providers stay request-time reads (no status writers)", () => {
    for (const rel of [
      "lib/mission-control/providers/site-health.ts",
      "lib/mission-control/providers/shopify-sync.ts",
      "lib/mission-control/providers/orders.ts",
      "lib/mission-control/live-snapshot.ts",
    ]) {
      const source = stripComments(readFileSync(join(root, rel), "utf8"));
      expect(WRITE_IMPORT.test(source), rel).toBe(false);
      expect(PRISMA_MUTATE.test(source), rel).toBe(false);
    }
  });
});
